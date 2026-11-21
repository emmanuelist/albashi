// Self-relay spike: the agent's own EOA submits an Altana session intent to the Orchestrator, with our
// attribution tag at the very end of the outer transaction (D-003).
//
// How: the SDK's normal execute() prepares and signs the intent through Altana's relay. We intercept its
// last request (wallet_sendPreparedCalls) before it leaves this machine, build the Intent from the relay's
// quote plus the session signature (wrapped the way the relay would), simulate Orchestrator.execute, and
// only then send it from the agent EOA with the tag appended.
//
//   node --env-file=.env.selfrelay selfrelay.mjs          dry run: balances, quotes; sends nothing
//   node --env-file=.env.selfrelay selfrelay.mjs --live   the real run on Celo mainnet
import { mkdirSync, writeFileSync } from 'node:fs';
import crypto from 'node:crypto';
import {
  createPublicClient, createWalletClient, http, encodeFunctionData, encodeAbiParameters, decodeFunctionResult,
  erc20Abi, concat, toHex, formatUnits, parseEther, getAddress,
} from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { CELO, createClient, signerFromPrivateKey, serializeSession, NATIVE_TOKEN } from '@altananetwork/sdk';
import * as Key from 'porto/viem/Key';
import { toDataSuffix, verifyTx } from '@celo/attribution-tags';

const LIVE = process.argv.includes('--live');
const CHAIN_ID = 42220;
const USDT = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e';
const CNGN = '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f';
const REACTOR = '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3';
const ORCHESTRATOR = '0xaf140d0416a994aebb3fa6212b16ce6700f09751';
const TEXTILE = 'https://api.textilecredit.com/v2';
const SWAP_USDT = 1_000_000n; // 1 USD₮
const CAP_USDT = 2_000_000n; // 2 USD₮ a day
const CELO_FEE_CAP = parseEther('5'); // wide, so a value-cap refusal can't be a fee-cap refusal

// The Intent struct exactly as the deployed Orchestrator declares it (verified source on Celo Blockscout).
const INTENT = {
  type: 'tuple',
  components: [
    { name: 'eoa', type: 'address' }, { name: 'executionData', type: 'bytes' }, { name: 'nonce', type: 'uint256' },
    { name: 'payer', type: 'address' }, { name: 'paymentToken', type: 'address' }, { name: 'paymentMaxAmount', type: 'uint256' },
    { name: 'combinedGas', type: 'uint256' }, { name: 'encodedPreCalls', type: 'bytes[]' }, { name: 'encodedFundTransfers', type: 'bytes[]' },
    { name: 'settler', type: 'address' }, { name: 'expiry', type: 'uint256' }, { name: 'isMultichain', type: 'bool' },
    { name: 'funder', type: 'address' }, { name: 'funderSignature', type: 'bytes' }, { name: 'settlerContext', type: 'bytes' },
    { name: 'paymentAmount', type: 'uint256' }, { name: 'paymentRecipient', type: 'address' }, { name: 'signature', type: 'bytes' },
    { name: 'paymentSignature', type: 'bytes' }, { name: 'supportedAccountImplementation', type: 'address' },
  ],
};
const EXECUTE_ABI = [{ type: 'function', name: 'execute', stateMutability: 'payable', inputs: [{ name: 'encodedIntent', type: 'bytes' }], outputs: [{ name: 'err', type: 'bytes4' }] }];

// ---------------------------------------------------------------- evidence
const ev = { startedAt: new Date().toISOString(), live: LIVE, steps: [] };
const stamp = ev.startedAt.replace(/[:.]/g, '-');
const json = (x) => JSON.stringify(x, (_, v) => (typeof v === 'bigint' ? v.toString() : typeof v === 'function' ? undefined : v), 2);
const save = () => { mkdirSync('evidence', { recursive: true }); writeFileSync(`evidence/selfrelay-${stamp}.json`, json(ev)); };
const step = async (name, fn) => {
  const t = Date.now();
  try { const out = await fn(); ev.steps.push({ name, ok: true, ms: Date.now() - t, out }); console.log(`✓ ${name}`, out === undefined ? '' : json(out).slice(0, 600)); return out; }
  catch (e) { const err = { message: e?.shortMessage ?? e?.message ?? String(e), code: e?.code }; ev.steps.push({ name, ok: false, ms: Date.now() - t, err }); console.log(`✗ ${name}: ${err.message.slice(0, 400)}`); return undefined; }
  finally { save(); }
};

// ---------------------------------------------------------------- keys and clients
const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Missing ${k} (run: node setup-selfrelay.mjs)`); process.exit(1); } return v; };
const owner = privateKeyToAccount(need('OWNER_KEY'));
const agent = privateKeyToAccount(need('AGENT_KEY'));
const sessionSigner = signerFromPrivateKey(need('SESSION_KEY'));
const signer = signerFromPrivateKey(need('OWNER_KEY'));
const PAYOUT_TO = getAddress(need('PAYOUT_TO'));
const tag = toDataSuffix(need('ATTRIBUTION_CODE'));
const transport = http('https://forno.celo.org');
const pub = createPublicClient({ chain: celo, transport });
const agentWallet = createWalletClient({ account: agent, chain: celo, transport });
const client = createClient({ chains: [CELO], agentIdentity: false }); // throwaway wallet: no ERC-8004 identity (D-004)
const wallet = { address: owner.address };

const bal = async () => {
  // 'pending', not 'latest': right after a receipt, forno's 'latest' can still return the old balance (2026-11-21 run).
  const r = async (t, a) => pub.readContract({ address: t, abi: erc20Abi, functionName: 'balanceOf', args: [a], blockTag: 'pending' });
  const g = (a) => pub.getBalance({ address: a, blockTag: 'pending' });
  const [oU, oN, oC, aC, pN] = await Promise.all([r(USDT, owner.address), r(CNGN, owner.address), g(owner.address), g(agent.address), r(CNGN, PAYOUT_TO)]);
  return { owner: { usdt: formatUnits(oU, 6), cngn: formatUnits(oN, 6), celo: formatUnits(oC, 18) }, agent: { celo: formatUnits(aC, 18) }, payoutCngn: formatUnits(pN, 6), raw: { oU, oN, oC, aC, pN } };
};

// ---------------------------------------------------------------- the interception
// While `capturing` is set, the SDK's wallet_sendPreparedCalls request is kept here and never sent.
let capturing = false, captured = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const body = typeof init?.body === 'string' ? init.body : '';
  if (capturing && body.includes('"wallet_sendPreparedCalls"')) {
    const req = JSON.parse(body);
    captured = (Array.isArray(req) ? req.find((r) => r.method === 'wallet_sendPreparedCalls') : req).params[0];
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: Array.isArray(req) ? req[0].id : req.id, error: { code: -32000, message: 'held for self-relay' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(input, init);
};

const hexBig = (v) => (v === undefined || v === null ? 0n : BigInt(v));
/** The Intent the relay would have submitted: its signed quote's intent, with the session's wrapped signature. */
function buildIntent(params) {
  const quote = params.context?.quote?.quotes?.[0];
  if (!quote?.intent) throw new Error(`no intent in the prepared context: ${json(params.context).slice(0, 300)}`);
  const i = quote.intent;
  const signature = params.key
    ? Key.wrapSignature(params.signature, { keyType: params.key.type, publicKey: params.key.publicKey, prehash: params.key.prehash ?? false })
    : params.signature;
  return {
    eoa: i.eoa, executionData: i.executionData, nonce: hexBig(i.nonce), payer: i.payer ?? '0x0000000000000000000000000000000000000000',
    paymentToken: i.paymentToken, paymentMaxAmount: hexBig(i.paymentMaxAmount ?? i.totalPaymentMaxAmount), combinedGas: hexBig(i.combinedGas),
    encodedPreCalls: i.encodedPreCalls ?? [], encodedFundTransfers: i.encodedFundTransfers ?? [], settler: i.settler ?? '0x0000000000000000000000000000000000000000',
    expiry: hexBig(i.expiry), isMultichain: Boolean(i.isMultichain), funder: i.funder ?? '0x0000000000000000000000000000000000000000',
    funderSignature: i.funderSignature ?? '0x', settlerContext: i.settlerContext ?? '0x', paymentAmount: hexBig(i.paymentAmount ?? i.totalPaymentAmount),
    paymentRecipient: i.paymentRecipient ?? '0x0000000000000000000000000000000000000000', signature, paymentSignature: i.paymentSignature ?? '0x',
    supportedAccountImplementation: i.supportedAccountImplementation ?? '0x0000000000000000000000000000000000000000',
  };
}

/** Prepare + sign through the SDK, hold the send, then submit from the agent EOA with the tag at the tail. */
async function selfRelay(session, calls, label) {
  captured = null; capturing = true;
  try { await client.execute({ session, calls, feeToken: NATIVE_TOKEN, chainId: CHAIN_ID }); }
  catch (e) { if (!captured) throw e; } // the held send makes execute throw; anything else is a real error
  finally { capturing = false; }
  if (!captured) throw new Error('the SDK sent nothing to hold');
  const intent = buildIntent(captured);
  const encoded = encodeAbiParameters([INTENT], [intent]);
  const data = concat([encodeFunctionData({ abi: EXECUTE_ABI, functionName: 'execute', args: [encoded] }), tag]);
  // Orchestrator.execute returns an error code instead of reverting, so simulate and require 0x00000000.
  const sim = await pub.call({ account: agent.address, to: ORCHESTRATOR, data });
  const err = decodeFunctionResult({ abi: EXECUTE_ABI, functionName: 'execute', data: sim.data });
  const out = { label, nonce: intent.nonce, paymentToken: intent.paymentToken, paymentAmount: intent.paymentAmount, paymentRecipient: intent.paymentRecipient, simulatedErr: err };
  if (err !== '0x00000000') throw Object.assign(new Error(`simulation returned error ${err}; not sending`), { out });
  if (!LIVE) return { ...out, sent: false };
  const gas = await pub.estimateGas({ account: agent.address, to: ORCHESTRATOR, data });
  const hash = await agentWallet.sendTransaction({ to: ORCHESTRATOR, data, gas: (gas * 13n) / 10n });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  const attribution = await verifyTx({ client: pub, hash });
  return { ...out, hash, status: receipt.status, from: agent.address, attribution };
}

// ---------------------------------------------------------------- run
console.log(`Owner ${owner.address} · agent ${agent.address} · payout ${PAYOUT_TO} · ${LIVE ? 'LIVE' : 'dry run'}`);
const before = await step('balances before', bal);
await step('textile preview 1 USD₮ → cNGN', async () => {
  const r = await realFetch(`${TEXTILE}/rfq/preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chainId: CHAIN_ID, sellToken: USDT, buyToken: CNGN, sellAmount: SWAP_USDT.toString() }) }).then((r) => r.json());
  return { buy: r.data?.buyAmount, available: r.data?.availableSellAmount };
});
if (!LIVE) { console.log('\nDry run done. Fund the owner (~22 CELO + 2 USD₮) and the agent (~0.5 CELO), then --live.'); process.exit(0); }
if (!before || before.raw.oU < CAP_USDT || before.raw.oC < parseEther('20') || before.raw.aC < parseEther('0.2')) { console.error('Not funded enough yet.'); process.exit(1); }

const permissions = {
  calls: [{ to: USDT }, { to: CNGN }, { to: REACTOR }],
  spend: [{ limit: CAP_USDT, period: 'day', token: USDT }, { limit: 10_000_000_000n, period: 'day', token: CNGN }, { limit: CELO_FEE_CAP, period: 'day' }],
};
await step('createWallet (EIP-7702 delegation)', async () => ({ address: (await client.createWallet({ signer })).address }));
let session = null; // the live Session object: execute needs it, and a re-grant costs ~20 CELO
await step('grantSession (USD₮ cap 2/day, CELO fee cap 5/day, 1 h)', async () => {
  session = await client.grantSession({ wallet, signer, permissions, expiry: Math.floor(Date.now() / 1000) + 3600, sessionSigner, feeToken: NATIVE_TOKEN, chainId: CHAIN_ID });
  writeFileSync('evidence/selfrelay-session.json', json(serializeSession(session)));
  return { publicKey: session.publicKey, expiry: session.expiry, transactionHash: session.transactionHash };
});
if (!session) process.exit(1);

// Textile firm quote with the Altana wallet as taker; the owner key proves control (the session's 1271 proof is refused).
const textile = (path, body) => realFetch(`${TEXTILE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(75_000) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const quote = await step('textile firm quote (taker = Altana wallet, owner proof)', async () => {
  const nonce = toHex(crypto.randomBytes(32)), issuedAt = Date.now();
  const signature = await owner.signTypedData({
    domain: { name: 'Textile Taker Control', version: '1', chainId: CHAIN_ID },
    types: { TakerControl: [{ name: 'taker', type: 'address' }, { name: 'chainId', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }, { name: 'issuedAt', type: 'uint256' }] },
    primaryType: 'TakerControl',
    message: { taker: owner.address, chainId: BigInt(CHAIN_ID), nonce, issuedAt: BigInt(issuedAt) },
  });
  const r = await textile('/rfq/request', { chainId: CHAIN_ID, sellToken: USDT, buyToken: CNGN, sellAmount: SWAP_USDT.toString(), taker: owner.address, takerProof: { nonce, issuedAt, signature } });
  if (r.status !== 200 || r.body?.data?.status !== 'quoted') throw new Error(`HTTP ${r.status} ${json(r.body).slice(0, 300)}`);
  const d = r.body.data;
  if (getAddress(d.quote.reactor) !== getAddress(REACTOR)) throw new Error(`unexpected reactor ${d.quote.reactor}`);
  return { rfqId: d.rfqId, takerPays: d.quote.takerPays, buyAmount: d.quote.buyAmount, expiresAt: d.quote.expiresAt, swap: d.transactions.swap };
});

// 1. The agent swaps 1 USD₮ → cNGN, self-relayed and tagged.
if (quote) {
  await step('SELF-RELAY swap [approve, swap]', async () => {
    if (Date.parse(quote.expiresAt) - Date.now() < 8000) throw new Error('quote about to expire; not sending');
    return selfRelay(session, [
      { to: USDT, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [REACTOR, BigInt(quote.takerPays)] }), value: 0n },
      { to: quote.swap.to, data: quote.swap.data, value: 0n },
    ], 'swap');
  });
}
// 2. The agent pays the cNGN out, self-relayed and tagged.
const mid = await step('balances after swap', bal);
if (mid && mid.raw.oN > 0n) {
  await step('SELF-RELAY cNGN payout', async () => selfRelay(session, [
    { to: CNGN, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [PAYOUT_TO, mid.raw.oN] }), value: 0n },
  ], 'payout'));
}
// 3. Over the USD₮ cap (1 used + 1.5 > 2): must be refused, and the refusal must name USD₮ this time.
await step('EXPECT REFUSAL: 1.5 USD₮ over the 2 USD₮/day cap (relay path, to read its reason)', async () => {
  const res = await client.execute({ session, calls: [{ to: USDT, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [PAYOUT_TO, 1_500_000n] }), value: 0n }], feeToken: NATIVE_TOKEN, chainId: CHAIN_ID });
  return { UNEXPECTED_SUCCESS: res.status, res };
});
// 4. The owner revokes; the agent is stopped.
await step('revokeSession (owner, one tx)', async () => {
  const r = await client.revokeSession({ wallet, signer, session, feeToken: NATIVE_TOKEN });
  return { status: r.status, transactionHash: r.transactionHash };
});
await step('EXPECT REFUSAL: agent self-relays after revoke', async () => selfRelay(session, [
  { to: USDT, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [PAYOUT_TO, 100_000n] }), value: 0n },
], 'after-revoke'));
await step('balances after', bal);
ev.finishedAt = new Date().toISOString();
save();
console.log(`\nEvidence: evidence/selfrelay-${stamp}.json`);
