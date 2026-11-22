// The first PayRun proof run on Celo mainnet, to Albashi's own test wallets.
//
//   node --env-file=.env scripts/proof-run.ts          dry run: balances, live rate, simulated deploy; sends nothing
//   node --env-file=.env scripts/proof-run.ts --live   the real run (needs the user's OK; it spends CELO and USD₮)
//
// Steps: deploy PayRun (agent, tagged) → owner wallet (EIP-7702) → owner approves PayRun for USD₮ → owner grants a
// session that may call only PayRun.run → owner signs a payslip → Textile firm quote with PayRun as the taker →
// the agent self-relays PayRun.run (tagged) → the agent tries the payslip with an unsigned recipient: PayRun refuses.
// Evidence (no keys) goes to docs/evidence/proof-run-<time>.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  concat, createPublicClient, createWalletClient, decodeErrorResult, encodeAbiParameters, encodeFunctionData, erc20Abi,
  formatUnits, http, keccak256, parseEther, toHex, type Address, type Hex,
} from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createClient, CELO, NATIVE_TOKEN, signerFromPrivateKey, serializeSession, type Session } from '@altananetwork/sdk';
import { toDataSuffix, verifyTx } from '@celo/attribution-tags';
import { payRunAbi } from '../src/abi.ts';
import { owed, signPayslip, validatePayslip, type Payslip } from '../src/payslip.ts';
import { buildRunCall } from '../src/payrun.ts';
import { selfRelay, SimulationRefused } from '../src/relay.ts';
import { approvePayRunCall, payRunPermissions } from '../src/session.ts';
import { CNGN, firmQuote, preview, REACTOR, signTakerProof, USDT } from '../src/textile.ts';

const LIVE = process.argv.includes('--live');
const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`missing ${k} in apps/agent/.env`);
  return v;
};
const agent = privateKeyToAccount(need('AGENT_KEY') as Hex);
const owner = privateKeyToAccount(need('OWNER_KEY') as Hex);
const ownerSigner = signerFromPrivateKey(need('OWNER_KEY') as Hex);
const sessionPrivateKey = need('SESSION_KEY') as Hex;
const recipientA = privateKeyToAccount(need('RECIPIENT_A_KEY') as Hex).address;
const recipientB = privateKeyToAccount(need('RECIPIENT_B_KEY') as Hex).address;
const tag = toDataSuffix(need('ATTRIBUTION_CODE'));
const transport = http(process.env.CELO_RPC_URL ?? 'https://forno.celo.org');
const pub = createPublicClient({ chain: celo, transport });
const agentWallet = createWalletClient({ account: agent, chain: celo, transport });
const altana = createClient({ chains: [CELO], agentIdentity: false });

// ---------------------------------------------------------------- evidence
const startedAt = new Date().toISOString();
const ev: { startedAt: string; live: boolean; steps: unknown[]; finishedAt?: string } = { startedAt, live: LIVE, steps: [] };
const evPath = new URL(`../../../docs/evidence/proof-run-${startedAt.replace(/[:.]/g, '-')}.json`, import.meta.url);
const json = (x: unknown) => JSON.stringify(x, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
const save = () => {
  mkdirSync(new URL('.', evPath), { recursive: true });
  writeFileSync(evPath, json(ev));
};
async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  const t = Date.now();
  try {
    const out = await fn();
    ev.steps.push({ name, ok: true, ms: Date.now() - t, out });
    console.log(`✓ ${name}`, out === undefined ? '' : json(out).slice(0, 700));
    return out;
  } catch (e) {
    const err = e as { shortMessage?: string; message?: string; name?: string };
    ev.steps.push({ name, ok: false, ms: Date.now() - t, err: { name: err.name, message: err.shortMessage ?? err.message } });
    console.log(`✗ ${name}: ${(err.shortMessage ?? err.message ?? String(e)).slice(0, 500)}`);
    return undefined;
  } finally {
    save();
  }
}

const balances = async () => {
  const erc = (t: Address, a: Address) => pub.readContract({ address: t, abi: erc20Abi, functionName: 'balanceOf', args: [a], blockTag: 'pending' });
  const [oU, oC, aC, rA, rB] = await Promise.all([
    erc(USDT, owner.address),
    pub.getBalance({ address: owner.address, blockTag: 'pending' }),
    pub.getBalance({ address: agent.address, blockTag: 'pending' }),
    erc(CNGN, recipientA),
    erc(CNGN, recipientB),
  ]);
  return {
    owner: { address: owner.address, usdt: formatUnits(oU, 6), celo: formatUnits(oC, 18) },
    agent: { address: agent.address, celo: formatUnits(aC, 18) },
    recipients: { [recipientA]: formatUnits(rA, 6), [recipientB]: formatUnits(rB, 6) },
    raw: { oU, oC, aC, rA, rB },
  };
};

// ---------------------------------------------------------------- the run
console.log(`Agent ${agent.address} · owner ${owner.address} · ${LIVE ? 'LIVE' : 'dry run'}`);
const before = await step('balances before', balances);
const rate = await step('Textile preview: cNGN for 1 USD₮', async () => (await preview(1_000_000n)).buyUnits);

// PayRun's creation code, constructor arguments, then the attribution tag. The constructor's arguments are four
// static addresses, so trailing bytes are ignored by its decoding; the dry run checks the simulated deploy.
const artifact = JSON.parse(readFileSync(new URL('../../../contracts/out/PayRun.sol/PayRun.json', import.meta.url), 'utf8'));
const creation = concat([
  artifact.bytecode.object as Hex,
  encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'address' }], [USDT, CNGN, REACTOR, agent.address]),
  tag,
]);
await step('simulate the PayRun deploy (tagged)', async () => {
  const sim = await pub.call({ account: agent.address, data: creation });
  const gas = await pub.estimateGas({ account: agent.address, data: creation });
  return { runtimeBytes: ((sim.data?.length ?? 2) - 2) / 2, gas, creationHash: keccak256(creation) };
});

if (!LIVE) {
  console.log('\nDry run done. Fund the owner (~24 CELO + 3 USD₮) and the agent (~1 CELO), then run with --live.');
  process.exit(0);
}
if (!before || !rate) process.exit(1);
if (before.raw.oU < 2_000_000n || before.raw.oC < parseEther('20') || before.raw.aC < parseEther('0.8')) {
  console.error('Not funded enough yet: owner needs ≥ 20 CELO and ≥ 2 USD₮, agent ≥ 0.8 CELO.');
  process.exit(1);
}

// 1. Deploy PayRun from the agent, tagged.
let payRun = (process.env.PAYRUN_ADDRESS || undefined) as Address | undefined;
if (!payRun) {
  const deployed = await step('deploy PayRun (agent, tagged)', async () => {
    const hash = await agentWallet.sendTransaction({ data: creation });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`deploy failed: ${hash}`);
    const attribution = await verifyTx({ client: pub, hash });
    const takerSigner = await pub.readContract({ address: receipt.contractAddress, abi: payRunAbi, functionName: 'TAKER_SIGNER' });
    return { hash, address: receipt.contractAddress, takerSigner, attribution };
  });
  if (!deployed) process.exit(1);
  payRun = deployed.address;
  const envPath = new URL('../.env', import.meta.url);
  writeFileSync(envPath, readFileSync(envPath, 'utf8').replace(/^PAYRUN_ADDRESS=.*$/m, `PAYRUN_ADDRESS=${payRun}`));
}

// 2-4. Owner actions (Altana relay, untagged by design, D-006).
const wallet = { address: owner.address };
await step('owner: createWallet (EIP-7702 delegation)', async () => ({ address: (await altana.createWallet({ signer: ownerSigner })).address }));
await step('owner: approve PayRun for 3 USD₮', async () => {
  const r = await altana.execute({ wallet, signer: ownerSigner, calls: [approvePayRunCall(payRun!, 3_000_000n)], feeToken: NATIVE_TOKEN, chainId: 42220 });
  return r;
});
let session: Session | undefined;
await step('owner: grant a session that may call only PayRun.run (USD₮ cap 3/day, 2 h)', async () => {
  session = await altana.grantSession({
    wallet,
    signer: ownerSigner,
    sessionSigner: signerFromPrivateKey(sessionPrivateKey),
    permissions: payRunPermissions(payRun!, 3_000_000n),
    expiry: Math.floor(Date.now() / 1000) + 2 * 3600,
    feeToken: NATIVE_TOKEN,
    chainId: 42220,
  });
  writeFileSync(new URL('../.session.json', import.meta.url), json(serializeSession(session)));
  return { publicKey: session.publicKey, expiry: session.expiry, permissions: session.permissions, transactionHash: (session as { transactionHash?: Hex }).transactionHash };
});
if (!session) process.exit(1);

// 5. The owner signs the payslip. Floor: 99% of the live rate; budget: 2 USD₮.
const payslip: Payslip = {
  owner: owner.address,
  lines: [
    { to: recipientA, amount: 600_000_000n },
    { to: recipientB, amount: 800_000_000n },
  ],
  maxUsdtIn: 2_000_000n,
  minRate: (rate * 99n) / 100n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  salt: toHex(crypto.getRandomValues(new Uint8Array(32))),
};
const problems = validatePayslip(payslip, BigInt(Math.floor(Date.now() / 1000)));
if (problems.length) throw new Error(problems.join(' '));
const ownerSignature = await signPayslip(owner, payRun, payslip);
ev.steps.push({ name: 'owner signs the payslip', ok: true, out: { payslip, owed: owed(payslip) } });
save();

// 6-7. Firm quote with PayRun as the taker, then the agent self-relays PayRun.run.
const quote = await step('Textile firm quote (taker = PayRun, agent proof via EIP-1271)', async () =>
  firmQuote({ taker: payRun!, buyUnits: owed(payslip), takerProof: await signTakerProof(agent, payRun!) }));
if (!quote) process.exit(1);
const runCall = buildRunCall({ payRun, payslip, ownerSignature, quote, nowSeconds: BigInt(Math.floor(Date.now() / 1000)) });
await step('agent: self-relay PayRun.run (tagged)', async () => {
  const r = await selfRelay({ pub, agent: agentWallet, session: session!, sessionPrivateKey, calls: [runCall], feeToken: NATIVE_TOKEN, send: true });
  const attribution = r.hash ? await verifyTx({ client: pub, hash: r.hash }) : null;
  return { ...r, attribution };
});
await step('balances after the run', balances);

// 8. The refusal: the same signature on a payslip with an unsigned recipient.
const stranger = privateKeyToAccount(keccak256(toHex('albashi-stranger'))).address;
const tampered: Payslip = { ...payslip, lines: [...payslip.lines, { to: stranger, amount: 10_000_000n }] };
const tamperedCall = {
  to: payRun,
  data: encodeFunctionData({ abi: payRunAbi, functionName: 'run', args: [tampered, ownerSignature, quote.takerPays, quote.swap.data] }),
  value: 0n,
};
await step('EXPECT REFUSAL: PayRun.run with a recipient the owner did not sign (eth_call from the owner)', async () => {
  try {
    await pub.call({ account: owner.address, to: payRun, data: tamperedCall.data });
    return { UNEXPECTED: 'the call did not revert' };
  } catch (e) {
    const data = (e as { cause?: { data?: Hex }; data?: Hex }).cause?.data ?? (e as { data?: Hex }).data;
    const decoded = data ? decodeErrorResult({ abi: payRunAbi, data }) : undefined;
    return { refused: true, error: decoded?.errorName, stranger };
  }
});
await step('EXPECT REFUSAL: the agent sends it anyway through the session (on-chain record)', async () => {
  try {
    return await selfRelay({ pub, agent: agentWallet, session: session!, sessionPrivateKey, calls: [tamperedCall], feeToken: NATIVE_TOKEN, send: true });
  } catch (e) {
    if (e instanceof SimulationRefused) return { refusedInSimulation: true, simulatedErr: e.simulatedErr };
    throw e;
  }
});
await step('balances after', balances);
ev.finishedAt = new Date().toISOString();
save();
console.log(`\nEvidence: ${evPath.pathname}`);
