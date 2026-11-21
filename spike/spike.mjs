// Spike: can an agent, acting from an Altana wallet on Celo mainnet under a session key, convert USD₮ to cNGN on
// Textile FX and pay a recipient, with the attribution tag on the wire, and is it stopped by its cap and by revoke?
//
//   node --env-file=.env spike.mjs          dry run: balances, fee tokens, grant quote, a Textile preview. Sends nothing.
//   node --env-file=.env spike.mjs --live   the real run (about 1 USD₮ swapped plus relay fees in CELO).
//
// Every step's outcome, including failures, is written to evidence/spike-<timestamp>.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { createPublicClient, encodeFunctionData, erc20Abi, http, toHex, concat, formatUnits } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { CELO, createClient, signerFromPrivateKey, serializeSession, signOrderTypedData } from '@altananetwork/sdk';
import { toDataSuffix, verifyTx, fromDataSuffix } from '@celo/attribution-tags';

const LIVE = process.argv.includes('--live');
const USDT = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e';
const CNGN = '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f';
const REACTOR = '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3'; // Textile LimitOrderReactor on Celo (event page)
const TEXTILE = 'https://api.textilecredit.com/v2';
const CHAIN_ID = 42220;
const SWAP_USDT = 1_000_000n; // 1 USD₮ (6 decimals)
const CAP_USDT = 2_000_000n; // the session may move at most 2 USD₮ a day

const ev = { startedAt: new Date().toISOString(), live: LIVE, steps: [] };
const stamp = ev.startedAt.replace(/[:.]/g, '-');
const save = () => { mkdirSync('evidence', { recursive: true }); writeFileSync(`evidence/spike-${stamp}.json`, JSON.stringify(ev, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)); };
const step = async (name, fn) => {
  const t = Date.now();
  try {
    const out = await fn();
    ev.steps.push({ name, ok: true, ms: Date.now() - t, out });
    console.log(`✓ ${name}`, out ?? '');
    return out;
  } catch (e) {
    const err = { message: e?.shortMessage ?? e?.message ?? String(e), code: e?.code, details: e?.details };
    ev.steps.push({ name, ok: false, ms: Date.now() - t, err });
    console.log(`✗ ${name}`, err.message);
    return undefined;
  } finally { save(); }
};

const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Missing ${k} in .env (run: node setup.mjs)`); process.exit(1); } return v; };
const adminKey = need('ADMIN_KEY'), sessionKey = need('SESSION_KEY'), recipientKey = need('RECIPIENT_KEY');
const code = (process.env.ATTRIBUTION_CODE ?? '').trim();
const suffix = code ? toDataSuffix(code) : '0x';
const tag = (data) => (code ? concat([data, suffix]) : data);
ev.attribution = code ? { code, suffix } : null;

const pub = createPublicClient({ chain: celo, transport: http('https://forno.celo.org') });
const admin = privateKeyToAccount(adminKey);
const recipient = privateKeyToAccount(recipientKey).address;
const client = createClient({ chains: [CELO], agentIdentity: false }); // throwaway wallet: no ERC-8004 identity
const signer = signerFromPrivateKey(adminKey);

const bal = async () => {
  const [usdt, cngn, celoBal, rUsdt, rCngn] = await Promise.all([
    pub.readContract({ address: USDT, abi: erc20Abi, functionName: 'balanceOf', args: [admin.address] }),
    pub.readContract({ address: CNGN, abi: erc20Abi, functionName: 'balanceOf', args: [admin.address] }),
    pub.getBalance({ address: admin.address }),
    pub.readContract({ address: USDT, abi: erc20Abi, functionName: 'balanceOf', args: [recipient] }),
    pub.readContract({ address: CNGN, abi: erc20Abi, functionName: 'balanceOf', args: [recipient] }),
  ]);
  return { wallet: { usdt: formatUnits(usdt, 6), cngn: formatUnits(cngn, 6), celo: formatUnits(celoBal, 18) }, recipient: { usdt: formatUnits(rUsdt, 6), cngn: formatUnits(rCngn, 6) }, raw: { usdt, cngn, celoBal } };
};

const textile = async (path, body, headers = {}) => {
  const r = await fetch(`${TEXTILE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(75_000) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
};
const takerControl = (nonce, issuedAt, taker) => ({
  domain: { name: 'Textile Taker Control', version: '1', chainId: CHAIN_ID },
  types: { TakerControl: [{ name: 'taker', type: 'address' }, { name: 'chainId', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }, { name: 'issuedAt', type: 'uint256' }] },
  primaryType: 'TakerControl',
  message: { taker, chainId: BigInt(CHAIN_ID), nonce, issuedAt: BigInt(issuedAt) },
});

// ---------------------------------------------------------------- 0. read-only checks
console.log(`Wallet ${admin.address} · recipient ${recipient} · ${LIVE ? 'LIVE' : 'dry run'} · tag ${code || '(none)'}`);
const wallet = { address: admin.address };
const before = await step('balances before', bal);
await step('relay fee tokens on Celo', async () => (await client.feeCurrencies({ chainId: CHAIN_ID })));
const permissions = {
  calls: [{ to: USDT }, { to: CNGN }, { to: REACTOR }],
  spend: [{ limit: CAP_USDT, period: 'day', token: USDT }, { limit: 10_000n * 10n ** 6n, period: 'day', token: CNGN }],
};
const expiry = Math.floor(Date.now() / 1000) + 60 * 60;
const sessionSigner = signerFromPrivateKey(sessionKey);
await step('quote grantSession (CELO fees)', async () => (await client.quoteGrantSession({ wallet, signer, permissions, expiry, sessionSigner, feeToken: '0x0000000000000000000000000000000000000000', chainId: CHAIN_ID })));
await step('textile preview 1 USD₮ → cNGN', async () => (await textile('/rfq/preview', { chainId: CHAIN_ID, sellToken: USDT, buyToken: CNGN, sellAmount: SWAP_USDT.toString() })).body);

if (!LIVE) { console.log('\nDry run complete. Fund the wallet, then re-run with --live.'); process.exit(0); }
if (!before || before.raw.usdt < 3_000_000n) { console.error('Need at least 3 USD₮ in the wallet for the live run.'); process.exit(1); }

// ---------------------------------------------------------------- 1. the wallet and the agent's session
await step('createWallet (EIP-7702 delegation)', async () => {
  const w = await client.createWallet({ signer });
  if (w.address.toLowerCase() !== admin.address.toLowerCase()) throw new Error(`wallet ${w.address} != admin EOA ${admin.address}`);
  return { address: w.address };
});
const session = await step('grantSession: allowlist USD₮/cNGN/reactor, cap 2 USD₮/day, 1 h expiry', async () => {
  const s = await client.grantSession({ wallet, signer, permissions, expiry, sessionSigner, feeToken: '0x0000000000000000000000000000000000000000', chainId: CHAIN_ID });
  writeFileSync('evidence/session.json', JSON.stringify(serializeSession(s), (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  return s;
});
if (!session) process.exit(1);
const sessionView = { publicKey: session.publicKey, expiry: session.expiry, transactionHash: session.transactionHash };
ev.session = sessionView;

// ---------------------------------------------------------------- 2. Textile firm quote, taker = the Altana wallet
const reqBody = { chainId: CHAIN_ID, sellToken: USDT, buyToken: CNGN, sellAmount: SWAP_USDT.toString(), taker: admin.address };
const quote = await step('textile firm quote (taker = Altana wallet)', async () => {
  let r = await textile('/rfq/request', reqBody);
  ev.proofAttempts = [];
  if (r.status === 401) {
    // Try the session key first (ERC-1271 through the account): the agent proves control, the owner is not involved.
    const nonce = toHex(crypto.randomBytes(32)), issuedAt = Date.now();
    const sig1271 = await signOrderTypedData(session, takerControl(nonce, issuedAt, admin.address)).catch((e) => { ev.proofAttempts.push({ via: 'session-1271', signError: e.message }); return null; });
    if (sig1271) { r = await textile('/rfq/request', { ...reqBody, takerProof: { nonce, issuedAt, signature: sig1271 } }); ev.proofAttempts.push({ via: 'session-1271', status: r.status, reason: r.body?.error?.details?.reason ?? r.body?.error }); }
  }
  if (r.status === 401) {
    // Fallback: the admin key signs plainly (the wallet address is the admin EOA under EIP-7702).
    const nonce = toHex(crypto.randomBytes(32)), issuedAt = Date.now();
    const sig = await admin.signTypedData(takerControl(nonce, issuedAt, admin.address));
    r = await textile('/rfq/request', { ...reqBody, takerProof: { nonce, issuedAt, signature: sig } });
    ev.proofAttempts.push({ via: 'admin-ecdsa', status: r.status, reason: r.body?.error?.details?.reason ?? r.body?.error });
  }
  if (r.status !== 200 || r.body?.data?.status !== 'quoted') throw Object.assign(new Error(`quote failed: HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`), { details: r.body });
  const d = r.body.data;
  if (d.quote.reactor.toLowerCase() !== REACTOR.toLowerCase()) throw new Error(`unexpected reactor ${d.quote.reactor}`);
  return { rfqId: d.rfqId, sell: d.quote.takerPays, buy: d.quote.buyAmount, fee: d.quote.feeAmount, expiresAt: d.quote.expiresAt, transactions: d.transactions };
});

// ---------------------------------------------------------------- 3. the agent swaps, from the wallet, inside its session
let swapTx;
if (quote) {
  swapTx = await step('execute [approve, swap] with the session key', async () => {
    if (Date.parse(quote.expiresAt) - Date.now() < 5000) throw new Error('quote about to expire; not sending');
    const approve = { to: USDT, data: tag(encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [REACTOR, BigInt(quote.sell)] })), value: 0n };
    const swap = { to: quote.transactions.swap.to, data: tag(quote.transactions.swap.data), value: 0n };
    const res = await client.execute({ session, calls: [approve, swap], feeToken: '0x0000000000000000000000000000000000000000', chainId: CHAIN_ID });
    if (res.status !== 'CONFIRMED') throw Object.assign(new Error(`execute ${res.status}`), { details: res });
    return res;
  });
}

// ---------------------------------------------------------------- 4. pay the recipient in cNGN
const mid = await step('balances after swap', bal);
let payTx;
if (mid && mid.raw.cngn > 0n) {
  payTx = await step('execute cNGN transfer to recipient (session)', async () => {
    const data = tag(encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [recipient, mid.raw.cngn] }));
    const res = await client.execute({ session, calls: [{ to: CNGN, data, value: 0n }], feeToken: '0x0000000000000000000000000000000000000000', chainId: CHAIN_ID });
    if (res.status !== 'CONFIRMED') throw Object.assign(new Error(`execute ${res.status}`), { details: res });
    return res;
  });
}

// ---------------------------------------------------------------- 5. the leash: over the cap, outside the allowlist, then revoked
await step('EXPECT REFUSAL: 1.5 USD₮ transfer would exceed the 2 USD₮/day cap', async () => {
  const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [recipient, 1_500_000n] });
  const res = await client.execute({ session, calls: [{ to: USDT, data, value: 0n }], feeToken: '0x0000000000000000000000000000000000000000', chainId: CHAIN_ID });
  return { UNEXPECTED_SUCCESS: res.status, res };
});
await step('EXPECT REFUSAL: call to a contract outside the allowlist', async () => {
  const res = await client.execute({ session, calls: [{ to: recipient, data: '0x', value: 0n }], feeToken: '0x0000000000000000000000000000000000000000', chainId: CHAIN_ID });
  return { UNEXPECTED_SUCCESS: res.status, res };
});
const revoke = await step('revokeSession (owner, one tx)', async () => (await client.revokeSession({ wallet, signer, session, feeToken: '0x0000000000000000000000000000000000000000' })));
await step('EXPECT REFUSAL: agent acts after revoke', async () => {
  const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [recipient, 100_000n] });
  const res = await client.execute({ session, calls: [{ to: USDT, data, value: 0n }], feeToken: '0x0000000000000000000000000000000000000000', chainId: CHAIN_ID });
  return { UNEXPECTED_SUCCESS: res.status, res };
});

// ---------------------------------------------------------------- 6. did the tag reach the chain?
for (const [name, r] of [['swap', swapTx], ['pay', payTx], ['grant', session ? { transactionHash: session.transactionHash } : null], ['revoke', revoke]]) {
  const hash = r?.transactionHash;
  if (!hash) continue;
  await step(`attribution on ${name} tx ${hash}`, async () => {
    const tx = await pub.getTransaction({ hash });
    const receipt = await pub.getTransactionReceipt({ hash });
    const outer = await verifyTx({ client: pub, hash }).catch((e) => ({ error: e.message }));
    return {
      from: tx.from, to: tx.to, status: receipt.status, gasUsed: receipt.gasUsed,
      outerSuffix: outer, // what an indexer reading the end of the calldata sees
      innerSuffixPresent: code ? tx.input.toLowerCase().includes(suffix.slice(2).toLowerCase()) : null,
      tailDecoded: fromDataSuffix(tx.input),
    };
  });
}
await step('balances after', bal);
ev.finishedAt = new Date().toISOString();
save();
console.log(`\nEvidence: evidence/spike-${stamp}.json`);
