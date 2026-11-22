// The first PayRun proof run on Celo mainnet, to Albashi's own test wallets.
//
//   node --env-file=.env scripts/proof-run.ts          dry run: balances, live rate, simulated deploy; sends nothing
//   node --env-file=.env scripts/proof-run.ts --live   the real run (needs the user's OK; it spends CELO and USD₮)
//
// Steps: deploy PayRun (agent, tagged) → owner wallet (EIP-7702) → the owner funds a USD₮ float in PayRun with two of
// its own transactions (tagged) → owner grants a session that may call only PayRun.run (Altana) → owner signs a
// payslip → Textile firm quote with PayRun as the taker → the agent self-relays PayRun.run (tagged) → the agent tries
// the payslip with an unsigned recipient: PayRun refuses. Each step already on chain is skipped on a re-run.
// Evidence (no keys) goes to docs/evidence/proof-run-<time>.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  concat, createPublicClient, createWalletClient, decodeErrorResult, encodeAbiParameters, encodeFunctionData, erc20Abi,
  formatUnits, getContractAddress, http, keccak256, parseEther, toHex, type Address, type Hex,
} from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createClient, CELO, NATIVE_TOKEN, deserializeSession, formatQuoteLine, signerFromPrivateKey, serializeSession, type Session,
} from '@altananetwork/sdk';
import { toDataSuffix, verifyTx } from '@celo/attribution-tags';
import { payRunAbi } from '../src/abi.ts';
import { owed, signPayslip, validatePayslip, type Payslip } from '../src/payslip.ts';
import { buildRunCall } from '../src/payrun.ts';
import { selfRelay, SimulationRefused } from '../src/relay.ts';
import { fundFloatCalls, payRunPermissions } from '../src/session.ts';
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
// The owner's own transactions (funding the float) carry the tag too: it is attached here, where the client is built.
const ownerWallet = createWalletClient({ account: owner, chain: celo, transport, dataSuffix: tag });
const altana = createClient({ chains: [CELO], agentIdentity: false });

// PayRun v1 (2026-11-22) pulled USD₮ from the owner's wallet, which Textile's proof-of-funds check rejects, and it has
// no withdraw: never send it USD₮. This run only zeroes the owner's old allowance to it.
const PAYRUN_V1: Address = '0x3Ef8f9A0dA701cE46b022b14E87315701D4bfeF7';
const FLOAT_TARGET = 1_500_000n;
const envPayRun = (process.env.PAYRUN_ADDRESS || undefined) as Address | undefined;
let payRun = envPayRun && envPayRun.toLowerCase() !== PAYRUN_V1.toLowerCase() ? envPayRun : undefined;

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
  const [oU, oC, aC, rA, rB, oF] = await Promise.all([
    erc(USDT, owner.address),
    pub.getBalance({ address: owner.address, blockTag: 'pending' }),
    pub.getBalance({ address: agent.address, blockTag: 'pending' }),
    erc(CNGN, recipientA),
    erc(CNGN, recipientB),
    payRun
      ? pub.readContract({ address: payRun, abi: payRunAbi, functionName: 'float', args: [owner.address], blockTag: 'pending' })
      : Promise.resolve(0n),
  ]);
  return {
    owner: { address: owner.address, usdt: formatUnits(oU, 6), celo: formatUnits(oC, 18), usdtFloatInPayRun: formatUnits(oF, 6) },
    agent: { address: agent.address, celo: formatUnits(aC, 18) },
    recipients: { [recipientA]: formatUnits(rA, 6), [recipientB]: formatUnits(rB, 6) },
    raw: { oU, oC, aC, rA, rB, oF },
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

// The session this run needs, and whether one already on file covers it.
const sessionFile = new URL('../.session.json', import.meta.url);
const target = payRun ?? getContractAddress({ from: agent.address, nonce: BigInt(await pub.getTransactionCount({ address: agent.address, blockTag: 'pending' })) });
let stored: { expiry?: number; walletAddress?: string; permissions?: { calls?: { to?: string }[] } } | undefined;
try {
  stored = JSON.parse(readFileSync(sessionFile, 'utf8'));
} catch {
  stored = undefined;
}
const sessionReusable = !!stored && (stored.expiry ?? 0) > Date.now() / 1000 + 600
  && stored.walletAddress?.toLowerCase() === owner.address.toLowerCase()
  && stored.permissions?.calls?.[0]?.to?.toLowerCase() === target.toLowerCase();
const expiry = Math.floor(Date.now() / 1000) + 2 * 3600;
const grantArgs = {
  wallet: { address: owner.address },
  signer: ownerSigner,
  sessionSigner: signerFromPrivateKey(sessionPrivateKey),
  permissions: payRunPermissions(target),
  expiry,
  feeToken: NATIVE_TOKEN,
  chainId: 42220,
} as const;
// Free: what the grant would cost (re-granting a key already registered should add no KeyStore fee).
const grantQuote = sessionReusable
  ? undefined
  : await step(`quote the grant: session that may call only PayRun.run at ${target}`, async () => {
    const q = await altana.quoteGrantSession(grantArgs);
    return { complete: q.complete, lines: q.lines.map((l) => formatQuoteLine(l, CELO)), neededCelo: formatUnits(q.lines.reduce((s, l) => s + l.needed, 0n), 18) };
  });

if (!LIVE) {
  console.log('\nDry run done. Nothing was sent.');
  process.exit(0);
}
if (!before || !rate) process.exit(1);
// The agent needs ~0.32 CELO to deploy PayRun, then ~0.08 per self-relayed transaction.
const agentNeeds = payRun ? parseEther('0.15') : parseEther('0.45');
// The owner needs the grant (if any), ~0.01 CELO of gas to fund the float, and ~0.35 CELO of relay fee for the run.
const grantNeeds = grantQuote ? parseEther(grantQuote.neededCelo) : 0n;
const ownerNeeds = grantNeeds + parseEther('0.4');
if (before.raw.oU + before.raw.oF < FLOAT_TARGET || before.raw.oC < ownerNeeds || before.raw.aC < agentNeeds) {
  console.error(`Not funded enough: owner needs ≥ ${formatUnits(ownerNeeds, 18)} CELO and ≥ 1.5 USD₮ (wallet + float), agent ≥ ${formatUnits(agentNeeds, 18)} CELO.`);
  process.exit(1);
}

// 1. Deploy PayRun from the agent, tagged.
if (!payRun) {
  const deployed = await step('deploy PayRun (agent, tagged)', async () => {
    const hash = await agentWallet.sendTransaction({ data: creation });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`deploy failed: ${hash}`);
    const attribution = await verifyTx({ client: pub, hash });
    // forno's 'latest' can lag a fresh receipt (2026-11-22 deploy): read at 'pending', retrying briefly.
    let takerSigner: Address | undefined;
    for (let i = 0; i < 10 && !takerSigner; i++) {
      try {
        takerSigner = await pub.readContract({ address: receipt.contractAddress, abi: payRunAbi, functionName: 'TAKER_SIGNER', blockTag: 'pending' });
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    return { hash, address: receipt.contractAddress, takerSigner, attribution };
  });
  if (!deployed) process.exit(1);
  if (deployed.address.toLowerCase() !== target.toLowerCase()) throw new Error(`deployed at ${deployed.address}, expected ${target}`);
  payRun = deployed.address;
  const envPath = new URL('../.env', import.meta.url);
  writeFileSync(envPath, readFileSync(envPath, 'utf8').replace(/^PAYRUN_ADDRESS=.*$/m, `PAYRUN_ADDRESS=${payRun}`));
}

// 2. The owner's wallet: an EOA with Altana's EIP-7702 delegation.
const ownerCode = await pub.getCode({ address: owner.address });
if (ownerCode && ownerCode !== '0x') {
  ev.steps.push({ name: 'owner wallet already set up (EIP-7702 delegation present); createWallet skipped', ok: true, out: { code: ownerCode.slice(0, 48) } });
  save();
} else {
  await step('owner: createWallet (EIP-7702 delegation)', async () => ({ address: (await altana.createWallet({ signer: ownerSigner })).address }));
}
// 3. The owner funds the float with two of its own transactions, tagged, and zeroes its old allowance to v1.
const ownerTx = async (call: { to: Address; data: Hex }) => {
  const hash = await ownerWallet.sendTransaction({ to: call.to, data: call.data });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`owner transaction failed: ${hash}`);
  return { hash, gasUsed: receipt.gasUsed, attribution: await verifyTx({ client: pub, hash }) };
};
const v1Allowance = await pub.readContract({ address: USDT, abi: erc20Abi, functionName: 'allowance', args: [owner.address, PAYRUN_V1], blockTag: 'pending' });
if (v1Allowance > 0n) {
  await step('owner: zero the USD₮ allowance to PayRun v1 (tagged)', async () =>
    ownerTx({ to: USDT, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [PAYRUN_V1, 0n] }) }));
}
const floatNow = await pub.readContract({ address: payRun, abi: payRunAbi, functionName: 'float', args: [owner.address], blockTag: 'pending' });
if (floatNow >= FLOAT_TARGET) {
  ev.steps.push({ name: 'owner float already funded; deposit skipped', ok: true, out: { float: floatNow } });
  save();
} else {
  const [approve, deposit] = fundFloatCalls(payRun, FLOAT_TARGET - floatNow);
  const funded = await step(`owner: approve PayRun for exactly ${formatUnits(FLOAT_TARGET - floatNow, 6)} USD₮ (tagged)`, async () => ownerTx(approve));
  if (!funded) process.exit(1);
  await step('owner: deposit it as the float (tagged)', async () => {
    const out = await ownerTx(deposit);
    const float = await pub.readContract({ address: payRun!, abi: payRunAbi, functionName: 'float', args: [owner.address], blockTag: 'pending' });
    return { ...out, float };
  });
}

// 4. The owner grants the agent's session key a session that may call only PayRun.run (Altana relay, untagged).
let session: Session | undefined;
if (sessionReusable && stored) {
  session = deserializeSession(stored as never, signerFromPrivateKey(sessionPrivateKey));
  ev.steps.push({ name: 'live PayRun-only session reused; grant skipped', ok: true, out: { publicKey: session.publicKey, expiry: session.expiry } });
  save();
} else {
  await step('owner: grant a session that may call only PayRun.run (2 h)', async () => {
    session = await altana.grantSession(grantArgs);
    writeFileSync(sessionFile, json(serializeSession(session)));
    return { publicKey: session.publicKey, expiry: session.expiry, permissions: session.permissions, transactionHash: (session as { transactionHash?: Hex }).transactionHash };
  });
}
if (!session) process.exit(1);

// 5. The owner signs the payslip. Floor: 99% of the live rate; budget: 1.5 USD₮ of the float.
const payslip: Payslip = {
  owner: owner.address,
  lines: [
    // Textile's RFQ minimum is $1 of notional (~₦1,440 on 2026-11-22), so the lines total ₦1,500.
    { to: recipientA, amount: 700_000_000n },
    { to: recipientB, amount: 800_000_000n },
  ],
  maxUsdtIn: 1_500_000n,
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
