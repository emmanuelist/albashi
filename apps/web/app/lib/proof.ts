// Server-side reads for the proof page. Every value comes from Celo mainnet or Textile's API at request
// time; nothing here is invented. When a source is down the caller gets `null` and says so on screen.
import { createPublicClient, erc20Abi, http, parseEventLogs, recoverTypedDataAddress, type Hash } from 'viem';
import { celo } from 'viem/chains';
import { verifyTx } from '@celo/attribution-tags';
import { payslipFromRunTx, runEvents } from '../agent/runner.ts';
import { payslipDomain, payslipTypes } from '../agent/payslip.ts';

const RPC = process.env.CELO_RPC_URL ?? 'https://forno.celo.org';
const TEXTILE = 'https://api.textilecredit.com/v2';
export const USDT = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as const;
export const CNGN = '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f' as const;
const DECIMALS = 6n; // USD₮ and cNGN, verified with decimals() on forno (docs/CONTEXT.md)
const REPO = 'https://github.com/emmanuelist/albashi/blob/main';

const client = createPublicClient({ chain: celo, transport: http(RPC, { timeout: 8_000 }) });

/**
 * forno sometimes answers a mined transaction's receipt (or the transaction) with null, about one read in six on
 * 2026-11-28; the same read a moment later succeeds. Reads of mined data are retried before the page says Celo is down.
 */
export async function settled<T>(read: () => Promise<T>, tries = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await read();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

/** Token base units to a display string with two decimals. Display only: never fed back into a transaction. */
export function formatUnits2(units: bigint): string {
  const cents = (units * 100n + 10n ** DECIMALS / 2n) / 10n ** DECIMALS;
  const whole = (cents / 100n).toLocaleString('en-US');
  return `${whole}.${(cents % 100n).toString().padStart(2, '0')}`;
}

/** Wall-clock time in Lagos (WAT, UTC+1) as HH:MM. */
export function wat(date: Date): string {
  return date.toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: false });
}
export function watDay(date: Date): string {
  return date.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short' });
}

export const short = (hex: string) => `${hex.slice(0, 6)}…${hex.slice(-4)}`;
export const celoscan = (hash: string) => `https://celoscan.io/tx/${hash}`;

export type Rate = { buyUnits: bigint; sellUnits: bigint; readAt: Date };

/** Textile's free RFQ preview for 1 USD₮ → cNGN (POST /rfq/preview, no auth). */
export async function readRate(): Promise<Rate | null> {
  try {
    const sellUnits = 10n ** DECIMALS;
    const res = await fetch(`${TEXTILE}/rfq/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chainId: celo.id, sellToken: USDT, buyToken: CNGN, sellAmount: sellUnits.toString() }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { buyAmount?: string } };
    if (!body.data?.buyAmount) return null;
    return { buyUnits: BigInt(body.data.buyAmount), sellUnits, readAt: new Date() };
  } catch {
    return null;
  }
}

export async function readBlockNumber(): Promise<bigint | null> {
  try {
    return await client.getBlockNumber();
  } catch {
    return null;
  }
}

export type Movement = {
  hash: Hash;
  at: Date;
  /** ERC-20 transfers in the transaction for the two tokens we use, in base units. */
  transfers: { token: 'USDT' | 'CNGN'; from: string; to: string; units: bigint }[];
};

export type Transfer = Movement['transfers'][number];

/** The USD₮ and cNGN Transfer events in a receipt's logs, in token base units. */
export function transfersFrom(logs: Parameters<typeof parseEventLogs>[0]['logs']): Transfer[] {
  return parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs }).flatMap((log) => {
    const addr = log.address.toLowerCase();
    const token = addr === USDT.toLowerCase() ? 'USDT' : addr === CNGN.toLowerCase() ? 'CNGN' : null;
    return token ? [{ token, from: log.args.from, to: log.args.to, units: log.args.value } as const] : [];
  });
}

/** A Textile swap: the cNGN that arrived, and every USD₮ unit the receiving wallet paid for it (maker + fee). */
export function summariseSwap(transfers: Transfer[]): { soldUnits: bigint; boughtUnits: bigint; wallet: string } | null {
  const cngn = transfers.find((t) => t.token === 'CNGN');
  if (!cngn) return null;
  const wallet = cngn.to.toLowerCase();
  const soldUnits = transfers.filter((t) => t.token === 'USDT' && t.from.toLowerCase() === wallet).reduce((s, t) => s + t.units, 0n);
  return soldUnits === 0n ? null : { soldUnits, boughtUnits: cngn.units, wallet: cngn.to };
}

/** Albashi's pay-run contract on Celo (PayRun v2, docs/EVIDENCE.md E-008). */
export const PAYRUN = '0xfa8d963525d5F28427B897A0C761C744A43e59Af' as const;

/** A pay run's payslip lines as paid: each cNGN transfer out of the pay-run contract, in order. */
export function summariseLines(transfers: Transfer[], payRun: string = PAYRUN): { units: bigint; to: string }[] {
  return transfers
    .filter((t) => t.token === 'CNGN' && t.from.toLowerCase() === payRun.toLowerCase())
    .map((t) => ({ units: t.units, to: t.to }));
}

/** A payout: the cNGN that moved and who received it. */
export function summarisePayout(transfers: Transfer[]): { units: bigint; to: string } | null {
  const cngn = transfers.find((t) => t.token === 'CNGN');
  return cngn ? { units: cngn.units, to: cngn.to } : null;
}

// A mined, successful transaction never changes, so a read that succeeded is kept for the life of the server
// process. Failures are not cached: the next request asks Celo again.
const movements = new Map<Hash, Movement>();

/** Reads a mined transaction's receipt and block from Celo and decodes its USD₮ / cNGN transfers. */
export async function readMovement(hash: Hash): Promise<Movement | null> {
  const known = movements.get(hash);
  if (known) return known;
  try {
    const receipt = await settled(() => client.getTransactionReceipt({ hash }));
    if (receipt.status !== 'success') return null;
    const block = await settled(() => client.getBlock({ blockNumber: receipt.blockNumber }));
    const movement = { hash, at: new Date(Number(block.timestamp) * 1000), transfers: transfersFrom(receipt.logs) };
    movements.set(hash, movement);
    return movement;
  } catch {
    return null;
  }
}

/** The mainnet transactions recorded in docs/EVIDENCE.md that the page shows. */
export const EVIDENCE = {
  /** E-002: the agent swapped 1 USD₮ → cNGN on Textile through Altana's relay. */
  swapViaRelay: '0x2226464a8499c60bbf80bb96e8f8432b938f976f84ca2148fbed4b8cb059f95d',
  /** E-003: the agent paid the cNGN to a second wallet. */
  payout: '0x37c107dbe9efcfa20ffe56d179045c2ac29dae9cd16d16f094bcf3c4355513db',
  /** E-005: the agent's own wallet submitted the swap and tagged it celo_3f5cac8c49f6. */
  swapSelfRelay: '0x6272cb58f29012a94b6ed19a486c24f3e4887ca4ad2418c296d4500e4d0130c5',
  /** E-008: the agent deployed PayRun v2, tagged. */
  payRunDeploy: '0xdd89af91bb759511f1e1dcbd87f2187428e801220ff24352844d679bc2d9e040',
  /** E-009: the owner deposited its USD₮ float into PayRun, from its own key, tagged. */
  floatDeposit: '0x42ae21fe0bbc8650067fd95c6f76693dad1b5f6cbeb7eb6848a0aa1dfb979628',
  /** E-009: the owner re-granted the agent's session to call only PayRun.run. */
  payRunGrant: '0x9d0edbbcab1024890e2898f89e35615a5971a99234d602e878a6f86ac0af1335',
  /** E-010: PayRun ran a signed payslip: one Textile swap, then each signed line paid in cNGN. Self-relayed, tagged. */
  payRun: '0xaaabd2dfa98b955f8e5edb3b9eabe1b7b0d750d4983bdb3152a30f5815b89bfc',
  /** E-016: the first pay run signed by the owner on the deployed desk (MetaMask), run by the agent's route, tagged. */
  deskRun: '0x7b5e0bb86b691472947a463461e92d0235c74256eaac8ae7d1b0e42af3251b94',
  /** E-015: the owner raised the session's daily relay-fee cap to 3 CELO (self-call, tagged). */
  feeCap: '0xf18922feece3195b4030dc937e4b987e0086ea0e03bbeb6e142c1ef8915ee28f',
  /** E-013: the agent registered its ERC-8004 identity (agent 10095), tagged. */
  erc8004: '0x025485429c8ddd3d78f4bc117f349ac935209868fb7f59455c8086ea8d179318',
} as const satisfies Record<string, Hash>;

/**
 * E-007: refused by the Altana session before anything reached Celo, so there is no transaction.
 * The captured run log is the proof. The run lasted 20:06:58–20:07:58 UTC; the refusal came after the swap.
 */
export const REFUSAL = {
  attemptedUnits: 1_500_000n,
  capUnits: 2_000_000n,
  /** E-005 had already moved 1 USD₮ against the cap earlier in the same run. */
  spentUnits: 1_000_000n,
  code: 'spend_limit_exceeded',
  at: new Date('2026-11-21T20:07:00Z'),
  proof: `${REPO}/docs/evidence/selfrelay-run-2026-11-21T20-07Z.json`,
} as const;

/**
 * E-011: the same owner signature on the E-010 payslip plus one recipient the owner never signed. PayRun refused it
 * (`NotSigned`) against mainnet state, and Altana's relay refused to price the intent, so nothing was signed or sent.
 * The captured run log is the proof (its last steps, 07:33 UTC).
 */
export const PAYSLIP_REFUSAL = {
  attemptedUnits: 10_000_000n,
  error: 'NotSigned',
  at: new Date('2026-11-22T07:33:00Z'),
  proof: `${REPO}/docs/evidence/proof-run-2026-11-22T07-32-07-970Z.json`,
} as const;

// ---- E-016 checked live: the pay run the owner signed on the desk, read back from Celo

const ORCHESTRATOR = '0xaf140d0416a994aebb3fa6212b16ce6700f09751'; // Altana's (Porto) Orchestrator on Celo
const AGENT = '0x1Bce3F6267983dfAb58CED6261EF05a28E168ce8'; // the agent wallet on file with the event (D-011)
const OWNER = '0x0EcaaFc1Bd6f7033d6eb038d8Cbc8a55f900D4B1'; // the demo agency's owner wallet
export const ATTRIBUTION_CODE = 'celo_3f5cac8c49f6';

export type Check = { what: string; ok: boolean; detail: string };
export type CheckRun = { checks: Check[]; at: Date };

/**
 * Six checks on E-016 that anyone can repeat from a Celo node: who sent it and where, that it mined, the attribution
 * tag, that the payslip inside carries the owner's own signature, and that PayRun paid exactly the signed lines.
 */
export async function checkDeskRun(): Promise<CheckRun | null> {
  try {
    const hash = EVIDENCE.deskRun;
    const [tx, receipt, tag] = await Promise.all([
      settled(() => client.getTransaction({ hash })),
      settled(() => client.getTransactionReceipt({ hash })),
      settled(() => verifyTx({ client, hash })),
    ]);
    const decoded = payslipFromRunTx(tx.input, PAYRUN);
    const signer = decoded
      ? await recoverTypedDataAddress({ domain: payslipDomain(PAYRUN), types: payslipTypes, primaryType: 'Payslip', message: decoded.payslip, signature: decoded.signature }).catch(() => null)
      : null;
    const signedByOwner = !!decoded && !!signer && signer.toLowerCase() === OWNER.toLowerCase() && decoded.payslip.owner.toLowerCase() === OWNER.toLowerCase();
    const ev = runEvents(receipt.logs, PAYRUN);
    const lines = decoded?.payslip.lines ?? [];
    const exact = lines.length > 0 && ev.paid.length === lines.length
      && lines.every((l, i) => ev.paid.some((p) => Number(p.line) === i && p.to.toLowerCase() === l.to.toLowerCase() && p.amount === l.amount));
    const checks: Check[] = [
      { what: 'sent by the agent’s own wallet', ok: tx.from.toLowerCase() === AGENT.toLowerCase(), detail: short(tx.from) },
      { what: 'sent to Altana’s Orchestrator, acting as the owner’s wallet', ok: tx.to?.toLowerCase() === ORCHESTRATOR, detail: short(tx.to ?? '0x') },
      { what: 'mined successfully', ok: receipt.status === 'success', detail: `block ${receipt.blockNumber.toLocaleString('en-US')}` },
      {
        what: `attribution tag ${ATTRIBUTION_CODE} at the end of the calldata`,
        ok: Boolean(tag?.codes?.includes(ATTRIBUTION_CODE)),
        detail: tag?.codes?.join(', ') ?? 'none',
      },
      { what: 'the payslip inside is signed by the owner’s wallet', ok: signedByOwner, detail: signer ? short(signer) : 'no payslip found' },
      {
        what: 'the payroll contract paid exactly the signed lines',
        ok: exact,
        detail: ev.paid.length ? ev.paid.map((p) => `₦${formatUnits2(p.amount)}`).join(' + ') : 'no payments',
      },
    ];
    return { checks, at: new Date() };
  } catch {
    return null;
  }
}

const txTimes = new Map<Hash, Date>();

/** When a mined transaction's block was produced. */
export async function readTxTime(hash: Hash): Promise<Date | null> {
  const known = txTimes.get(hash);
  if (known) return known;
  try {
    const receipt = await settled(() => client.getTransactionReceipt({ hash }));
    const block = await settled(() => client.getBlock({ blockNumber: receipt.blockNumber }));
    const at = new Date(Number(block.timestamp) * 1000);
    txTimes.set(hash, at);
    return at;
  } catch {
    return null;
  }
}

/** Owner actions on mainnet (docs/EVIDENCE.md E-001, E-004, E-006). */
export const OWNER_TXS = {
  grant: '0x26effe048111c592a476d9904b7b9192c08de75b6d1b485998981a0d44d6e6de',
  revoke: '0xe43b71c664d21366a2f832d5fed97b4a0293055cc7558e66ef24565685453e08',
  grant2: '0xb021c98e1e15892c7d864c42f0cf67710379015113192bbbadb7c9ba5dfb1b4e',
  revoke2: '0xc4acb8a8f3e149c51fc4ed4a3314a2f4b2f388e6f665fc33cddcf60b14b9763f',
} as const satisfies Record<string, Hash>;

export const SPIKE_RUN_LOG = `${REPO}/docs/evidence/spike-run-2026-11-21T16-33Z.json`;
export const REPO_URL = 'https://github.com/emmanuelist/albashi';
