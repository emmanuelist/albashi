// Unit tests for the page's money and time formatting and its receipt parsing. The receipts are the raw
// mainnet captures in docs/evidence/ (E-002, E-003, E-005, E-010), so these run offline against real data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAYRUN, formatUnits2, summariseLines, summarisePayout, summariseSwap, transfersFrom, wat, watDay, short } from '../app/lib/proof.ts';

const evidence = (name: string) => {
  const path = fileURLToPath(new URL(`../../../docs/evidence/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as { receipt: { logs: Parameters<typeof transfersFrom>[0] } };
};
const E002 = evidence('E-002-0x2226464a8499c60bbf80bb96e8f8432b938f976f84ca2148fbed4b8cb059f95d.json');
const E003 = evidence('E-003-0x37c107dbe9efcfa20ffe56d179045c2ac29dae9cd16d16f094bcf3c4355513db.json');
const E005 = evidence('E-005-0x6272cb58f29012a94b6ed19a486c24f3e4887ca4ad2418c296d4500e4d0130c5.json');
const E010 = evidence('E-010-0xaaabd2dfa98b955f8e5edb3b9eabe1b7b0d750d4983bdb3152a30f5815b89bfc.json');

test('formatUnits2 rounds 6-decimal base units to two places, half up, with grouping', () => {
  assert.equal(formatUnits2(1_441_117_203n), '1,441.12');
  assert.equal(formatUnits2(1_440_569_022n), '1,440.57');
  assert.equal(formatUnits2(1_000_000n), '1.00');
  assert.equal(formatUnits2(1_005_000n), '1.01');
  assert.equal(formatUnits2(1_004_999n), '1.00');
  assert.equal(formatUnits2(5n), '0.00');
  assert.equal(formatUnits2(0n), '0.00');
  assert.equal(formatUnits2(2_000_000_000_000n), '2,000,000.00');
});

test('times are shown in Lagos (WAT, UTC+1)', () => {
  const at = new Date('2026-11-21T16:34:10Z');
  assert.equal(wat(at), '17:34');
  assert.equal(watDay(at), '21 Nov');
  assert.equal(wat(new Date('2026-11-21T23:30:00Z')), '00:30'); // past midnight in Lagos
  assert.equal(watDay(new Date('2026-11-21T23:30:00Z')), '22 Nov');
});

test('short keeps the first 4 and last 4 hex characters', () => {
  assert.equal(short('0x37c107dbe9efcfa20ffe56d179045c2ac29dae9cd16d16f094bcf3c4355513db'), '0x37c1…13db');
});

test('E-005: the self-relayed swap sold 1 USD₮ (maker + fee) for 1,440.569022 cNGN', () => {
  const swap = summariseSwap(transfersFrom(E005.receipt.logs));
  assert.ok(swap);
  assert.equal(swap.soldUnits, 1_000_000n); // 999,801 to the maker + 199 fee (docs/EVIDENCE.md E-005)
  assert.equal(swap.boughtUnits, 1_440_569_022n);
  assert.equal(swap.wallet.toLowerCase(), '0x0ecaafc1bd6f7033d6eb038d8cbc8a55f900d4b1');
});

test('E-002: the relay swap bought 1,441.117203 cNGN', () => {
  const swap = summariseSwap(transfersFrom(E002.receipt.logs));
  assert.ok(swap);
  assert.equal(swap.boughtUnits, 1_441_117_203n);
  assert.equal(formatUnits2(swap.soldUnits), '1.00');
});

test('E-003: the payout moved 1,441.117203 cNGN to one wallet', () => {
  const payout = summarisePayout(transfersFrom(E003.receipt.logs));
  assert.ok(payout);
  assert.equal(payout.units, 1_441_117_203n);
  assert.equal(short(payout.to), '0x48D1…0120');
});

test('a payout is not mistaken for a swap: no USD₮ left the receiving wallet', () => {
  assert.equal(summariseSwap(transfersFrom(E003.receipt.logs)), null);
});

test('a receipt with no token transfers yields nothing rather than a guess', () => {
  assert.deepEqual(transfersFrom([]), []);
  assert.equal(summariseSwap([]), null);
  assert.equal(summarisePayout([]), null);
});

test('E-010: the pay run swapped 1.040028 USD₮ (maker + fee) for exactly the ₦1,500 the payslip owed', () => {
  const swap = summariseSwap(transfersFrom(E010.receipt.logs));
  assert.ok(swap);
  assert.equal(swap.wallet.toLowerCase(), PAYRUN.toLowerCase(), 'the pay-run contract was the taker');
  assert.equal(swap.soldUnits, 1_040_028n);
  assert.equal(swap.boughtUnits, 1_500_000_000n);
});

test('E-010: the signed lines were paid out of the pay-run contract, in order, and nothing else', () => {
  const lines = summariseLines(transfersFrom(E010.receipt.logs));
  assert.deepEqual(lines.map((l) => [short(l.to), l.units]), [
    ['0xBAa4…E33b', 700_000_000n],
    ['0x57f0…58E8', 800_000_000n],
  ]);
  assert.deepEqual(summariseLines(transfersFrom(E003.receipt.logs)), [], 'a plain payout is not a pay run');
});
