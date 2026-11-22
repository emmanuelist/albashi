import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recoverTypedDataAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { owed, payslipDigest, payslipDomain, payslipTypes, signPayslip, validatePayslip, type Payslip } from '../src/payslip.ts';
import { checkQuoteForRun, parseFirmQuote, preview, REACTOR, signTakerProof, takerControlTypes, type FirmQuote } from '../src/textile.ts';
import { VECTOR, VECTOR_PAYRUN } from './vector.ts';

// The same constant contracts/test/PayRunDigest.t.sol requires PayRun.hashPayslip to return.
const CONTRACT_DIGEST = '0x7a7f9980f94ebff2791fbdf0262b03dc732a3bf122acded81f559f928bc57efd';

const owner = privateKeyToAccount('0x00000000000000000000000000000000000000000000000000000000000a11ce');
const agent = privateKeyToAccount('0x000000000000000000000000000000000000000000000000000000000007a4e5');

test('the agent hashes a payslip exactly as PayRun does', () => {
  assert.equal(payslipDigest(VECTOR_PAYRUN, VECTOR), CONTRACT_DIGEST);
});

test('an owner-signed payslip recovers to the owner', async () => {
  const p: Payslip = { ...VECTOR, owner: owner.address };
  const signature = await signPayslip(owner, VECTOR_PAYRUN, p);
  const signer = await recoverTypedDataAddress({
    domain: payslipDomain(VECTOR_PAYRUN), types: payslipTypes, primaryType: 'Payslip', message: p, signature,
  });
  assert.equal(signer, owner.address);
});

test('only the payslip owner can sign it', async () => {
  await assert.rejects(signPayslip(agent, VECTOR_PAYRUN, { ...VECTOR, owner: owner.address }), /not the payslip owner/);
});

test('any change to a signed payslip changes its digest', () => {
  const base = payslipDigest(VECTOR_PAYRUN, VECTOR);
  const extraLine = { ...VECTOR, lines: [...VECTOR.lines, { to: '0x4444444444444444444444444444444444444444' as const, amount: 1n }] };
  const moreMoney = { ...VECTOR, lines: [VECTOR.lines[0]!, { ...VECTOR.lines[1]!, amount: VECTOR.lines[1]!.amount + 1n }] };
  const lowerFloor = { ...VECTOR, minRate: VECTOR.minRate - 1n };
  for (const changed of [extraLine, moreMoney, lowerFloor]) assert.notEqual(payslipDigest(VECTOR_PAYRUN, changed), base);
  assert.notEqual(payslipDigest(VECTOR_PAYRUN, VECTOR, 11142220), base, 'bound to the chain');
});

test('validatePayslip catches what PayRun would refuse, as sentences', () => {
  const now = 1_700_000_000n;
  assert.deepEqual(validatePayslip(VECTOR, now), []);
  assert.equal(owed(VECTOR), 1_400_000_000n);
  const bad = validatePayslip(
    { ...VECTOR, lines: [{ to: '0x0000000000000000000000000000000000000000', amount: 0n }], deadline: now - 1n },
    now,
  );
  assert.ok(bad.includes('Line 1 has no recipient.'));
  assert.ok(bad.includes('Line 1 pays nothing.'));
  assert.ok(bad.includes('The deadline has passed.'));
  // A 0.9 USD₮ budget at a ₦1,430 floor buys at most ₦1,287, less than the ₦1,400 these lines owe.
  const tooSmall = validatePayslip({ ...VECTOR, maxUsdtIn: 900_000n }, now);
  assert.ok(tooSmall.includes('At the minimum rate, the USD₮ budget cannot buy enough cNGN for every line.'));
});

// The firm-quote shape seen on mainnet (docs/evidence/selfrelay-run-2026-11-21T20-07Z.json).
const QUOTED = {
  data: {
    status: 'quoted',
    rfqId: 'rfq_OpPFgAa2VPi7f4xb',
    quote: { reactor: REACTOR, takerPays: '1000000', buyAmount: '1440569022', expiresAt: '2026-11-21T20:09:36.000Z' },
    transactions: { swap: { to: REACTOR, data: '0x0d7a16c3' + '00'.repeat(32), value: '0', chainId: 42220 } },
  },
};

test('parseFirmQuote reads the mainnet response shape', () => {
  const q = parseFirmQuote(QUOTED);
  assert.equal(q.takerPays, 1_000_000n);
  assert.equal(q.buyAmount, 1_440_569_022n);
  assert.equal(q.swap.to, REACTOR);
  assert.deepEqual(checkQuoteForRun(q, 2_000_000n), []);
});

test('parseFirmQuote refuses a response that is not a quote', () => {
  assert.throws(() => parseFirmQuote({ data: { status: 'no_quote' } }), /did not quote/);
  assert.throws(() => parseFirmQuote({ data: { status: 'quoted', quote: {} } }), /without takerPays/);
});

test('checkQuoteForRun refuses quotes PayRun would refuse', () => {
  const q: FirmQuote = parseFirmQuote(QUOTED);
  const elsewhere = { ...q, swap: { ...q.swap, to: '0x1111111111111111111111111111111111111111' as const } };
  assert.match(checkQuoteForRun(elsewhere, 2_000_000n).join(' '), /not on Textile's reactor/);
  const transfer = { ...q, swap: { ...q.swap, data: ('0xa9059cbb' + '00'.repeat(64)) as Hex } };
  assert.match(checkQuoteForRun(transfer, 2_000_000n).join(' '), /not a reactor fill/);
  assert.match(checkQuoteForRun(q, 999_999n).join(' '), /more USD₮ than the payslip allows/);
});

test("the taker proof is the agent's EIP-712 signature over Textile's TakerControl", async () => {
  const taker = VECTOR_PAYRUN;
  const proof = await signTakerProof(agent, taker, 1_763_755_200_000);
  const signer = await recoverTypedDataAddress({
    domain: { name: 'Textile Taker Control', version: '1', chainId: 42220 },
    types: takerControlTypes,
    primaryType: 'TakerControl',
    message: { taker, chainId: 42220n, nonce: proof.nonce, issuedAt: BigInt(proof.issuedAt) },
    signature: proof.signature,
  });
  assert.equal(signer, agent.address);
  assert.equal(proof.nonce.length, 66);
});

test('live: Textile previews USD₮ → cNGN (TEXTILE_LIVE=1)', { skip: process.env.TEXTILE_LIVE !== '1' }, async () => {
  const { buyUnits } = await preview(1_000_000n);
  assert.ok(buyUnits > 1_000_000_000n && buyUnits < 3_000_000_000n, `1 USD₮ → ${buyUnits} cNGN units`);
});
