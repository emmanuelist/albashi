// What the owner desk shows, read from Celo at request time: the agency's pay runs (PayRun's own Ran and Paid
// events, each with the payslip and signature decoded from its transaction), its USD₮ float and wallet balance,
// and the agent's session on the owner's account (expiry, permitted calls, spend caps). Nothing is filled in:
// a read that fails comes back null and the page says so.
import { createPublicClient, erc20Abi, http, parseAbi, parseAbiItem, recoverTypedDataAddress, type Address, type Hash, type Hex, type Log } from 'viem';
import { celo } from 'viem/chains';
import { unstable_cache } from 'next/cache';
import { payRunAbi } from '../agent/abi.ts';
import { payslipFromRunTx, runEvents } from '../agent/runner.ts';
import { payslipDomain, payslipTypes, type Payslip } from '../agent/payslip.ts';
import { PAYRUN, USDT, settled } from './proof.ts';

// forno occasionally drops a request from a serverless region; viem retries each call (3 tries, backing off) so one
// hiccup in ten chunked reads doesn't hide the whole history.
const client = createPublicClient({ chain: celo, transport: http(process.env.CELO_RPC_URL ?? 'https://forno.celo.org', { timeout: 10_000, retryCount: 3, retryDelay: 400 }) });

/** The demo agency's owner wallet (docs/STATE.md) and the agent's session key on it (E-009, E-011). */
export const DESK_OWNER: Address = '0x0EcaaFc1Bd6f7033d6eb038d8Cbc8a55f900D4B1';
export const SESSION_KEY_HASH: Hex = '0x655198e5d3b27ac148df494a3b87f73f2aeba50bcfaa838c9c126e7216df4750';
const PAYRUN_DEPLOY_BLOCK = 83_431_605n; // E-008
const ORCHESTRATOR = '0xaf140d0416a994aebb3fa6212b16ce6700f09751';

const ACCOUNT = parseAbi([
  'function getKey(bytes32 keyHash) view returns ((uint40 expiry, uint8 keyType, bool isSuperAdmin, bytes publicKey) key)',
  'function canExecutePackedInfos(bytes32 keyHash) view returns (bytes32[])',
  'function spendInfos(bytes32 keyHash) view returns ((address token, uint8 period, uint256 limit, uint256 spent, uint256 lastUpdated, uint256 currentSpent, uint256 current)[] results)',
]);

export type PaidLine = { line: number; to: Address; amount: bigint };
export type Run = {
  hash: Hash;
  at: string;
  digest: Hex;
  payslip: Payslip | null;
  usdtSpent: bigint;
  cngnReceived: bigint;
  cngnPaid: bigint;
  paid: PaidLine[];
  /** Who signed the payslip inside the run, recovered from its EIP-712 signature (null if it couldn't be decoded). */
  signer: Address | null;
};

type RunJson = Omit<Run, 'usdtSpent' | 'cngnReceived' | 'cngnPaid' | 'paid' | 'payslip'> & {
  usdtSpent: string;
  cngnReceived: string;
  cngnPaid: string;
  paid: { line: number; to: Address; amount: string }[];
  payslip: null | { owner: Address; lines: { to: Address; amount: string }[]; maxUsdtIn: string; minRate: string; deadline: string; salt: Hex };
};

// A mined run never changes, so each one is read once and kept.
const runJson = unstable_cache(
  async (hash: Hash): Promise<RunJson> => {
    const [tx, receipt] = await Promise.all([settled(() => client.getTransaction({ hash })), settled(() => client.getTransactionReceipt({ hash }))]);
    const block = await settled(() => client.getBlock({ blockNumber: receipt.blockNumber }));
    const ev = runEvents(receipt.logs as Log[], PAYRUN);
    if (!ev.ran) throw new Error(`${hash} has no Ran event`);
    const decoded = payslipFromRunTx(tx.input, PAYRUN);
    const p = decoded?.payslip;
    const signer = decoded
      ? await recoverTypedDataAddress({ domain: payslipDomain(PAYRUN), types: payslipTypes, primaryType: 'Payslip', message: decoded.payslip, signature: decoded.signature }).catch(() => null)
      : null;
    return {
      signer,
      hash,
      at: new Date(Number(block.timestamp) * 1000).toISOString(),
      digest: ev.ran.digest,
      usdtSpent: ev.ran.usdtSpent.toString(),
      cngnReceived: ev.ran.cngnReceived.toString(),
      cngnPaid: ev.ran.cngnPaid.toString(),
      paid: ev.paid.map((x) => ({ line: Number(x.line), to: x.to, amount: x.amount.toString() })),
      payslip: p
        ? { owner: p.owner, lines: p.lines.map((l) => ({ to: l.to, amount: l.amount.toString() })), maxUsdtIn: p.maxUsdtIn.toString(), minRate: p.minRate.toString(), deadline: p.deadline.toString(), salt: p.salt }
        : null,
    };
  },
  ['desk-run-v2'],
  { revalidate: false },
);

function runFrom(j: RunJson): Run {
  return {
    ...j,
    usdtSpent: BigInt(j.usdtSpent),
    cngnReceived: BigInt(j.cngnReceived),
    cngnPaid: BigInt(j.cngnPaid),
    paid: j.paid.map((x) => ({ ...x, amount: BigInt(x.amount) })),
    payslip: j.payslip
      ? { ...j.payslip, lines: j.payslip.lines.map((l) => ({ ...l, amount: BigInt(l.amount) })), maxUsdtIn: BigInt(j.payslip.maxUsdtIn), minRate: BigInt(j.payslip.minRate), deadline: BigInt(j.payslip.deadline) }
      : null,
  };
}

const RAN = parseAbiItem('event Ran(bytes32 indexed digest, address indexed owner, uint256 usdtSpent, uint256 cngnReceived, uint256 cngnPaid, uint256 lines)');
// forno refuses eth_getLogs over more than a few thousand blocks, so PayRun's history is read in fixed 5,000-block
// chunks. A chunk that ended before the latest block can never change and is cached for good; only the head chunk
// is read on every request.
const CHUNK = 5_000n;
const ranInChunk = (owner: Address, start: bigint, end: bigint) =>
  settled(() => client.getLogs({ address: PAYRUN, event: RAN, args: { owner }, fromBlock: start, toBlock: end })).then((logs) => logs.map((l) => l.transactionHash));
const finishedChunk = unstable_cache(
  async (owner: Address, start: string): Promise<Hash[]> => ranInChunk(owner, BigInt(start), BigInt(start) + CHUNK - 1n),
  ['desk-ran-chunk-v1'],
  { revalidate: false },
);

/** One pay run by its transaction, or null when it isn't a PayRun run or Celo didn't answer. */
export async function readRun(hash: Hash): Promise<Run | null> {
  try {
    return runFrom(await runJson(hash));
  } catch {
    return null;
  }
}

/** Every pay run this owner has had, newest first, from PayRun's Ran events. */
export async function readRuns(owner: Address = DESK_OWNER): Promise<Run[] | null> {
  try {
    const latest = await settled(() => client.getBlockNumber());
    const starts: bigint[] = [];
    for (let b = PAYRUN_DEPLOY_BLOCK; b <= latest; b += CHUNK) starts.push(b);
    const hashes: Hash[] = [];
    for (let i = 0; i < starts.length; i += 4) {
      const batch = await Promise.all(starts.slice(i, i + 4).map((b) => (b + CHUNK - 1n < latest ? finishedChunk(owner, b.toString()) : ranInChunk(owner, b, latest))));
      hashes.push(...batch.flat());
    }
    const unique = [...new Set(hashes)].reverse();
    return (await Promise.all(unique.map((h) => runJson(h)))).map(runFrom);
  } catch (e) {
    console.error('desk: runs unreadable', (e as Error).message?.slice(0, 200));
    return null;
  }
}

export type Session = {
  expiry: Date;
  live: boolean;
  /** The contract calls the key may make, other than Porto's own fee-payment permission on the Orchestrator. */
  calls: { to: Address; selector: Hex }[];
  orchestratorDefault: boolean;
  caps: { token: Address; limit: bigint; spentToday: bigint }[];
};

export type Owner = { float: bigint; totalFloat: bigint; walletUsdt: bigint; session: Session | null };

export async function readOwner(owner: Address = DESK_OWNER): Promise<Owner | null> {
  try {
    const [float, totalFloat, walletUsdt, key, packed, spend] = await Promise.all([
      client.readContract({ address: PAYRUN, abi: payRunAbi, functionName: 'float', args: [owner] }),
      client.readContract({ address: PAYRUN, abi: payRunAbi, functionName: 'totalFloat' }),
      client.readContract({ address: USDT, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }),
      client.readContract({ address: owner, abi: ACCOUNT, functionName: 'getKey', args: [SESSION_KEY_HASH] }).catch(() => null),
      client.readContract({ address: owner, abi: ACCOUNT, functionName: 'canExecutePackedInfos', args: [SESSION_KEY_HASH] }).catch(() => [] as readonly Hex[]),
      client.readContract({ address: owner, abi: ACCOUNT, functionName: 'spendInfos', args: [SESSION_KEY_HASH] }).catch(() => []),
    ]);
    const all = packed.map((p) => ({ to: (`0x${p.slice(2, 42)}`) as Address, selector: (`0x${p.slice(58, 66)}`) as Hex }));
    const session: Session | null = key && key.expiry > 0
      ? {
          expiry: new Date(key.expiry * 1000),
          live: key.expiry * 1000 > Date.now(),
          calls: all.filter((c) => c.to.toLowerCase() !== ORCHESTRATOR),
          orchestratorDefault: all.some((c) => c.to.toLowerCase() === ORCHESTRATOR),
          caps: spend.map((s) => ({ token: s.token, limit: s.limit, spentToday: s.currentSpent })),
        }
      : null;
    return { float, totalFloat, walletUsdt, session };
  } catch {
    return null;
  }
}
