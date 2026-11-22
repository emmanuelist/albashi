// The runner against real mainnet data: E-010's raw transaction and receipt (docs/evidence/), and, with
// CELO_LIVE=1, PayRun's own verdict on that payslip read from Celo (a free eth_call; nothing is sent).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPublicClient, http, type Hex, type Log } from 'viem';
import { celo } from 'viem/chains';
import { judge, payslipFromRunTx, runEvents } from '../src/runner.ts';

const PAYRUN = '0xfa8d963525d5F28427B897A0C761C744A43e59Af';
const E010 = JSON.parse(readFileSync(new URL('../../../docs/evidence/E-010-0xaaabd2dfa98b955f8e5edb3b9eabe1b7b0d750d4983bdb3152a30f5815b89bfc.json', import.meta.url), 'utf8')) as {
  transaction: { input: Hex };
  receipt: { logs: Log[] };
};
const STRANGER = '0x155720001349A7EB406d5450a21375794a0fddF2';

test('E-010: the signed payslip and the owner signature come back out of the tagged run transaction', () => {
  const found = payslipFromRunTx(E010.transaction.input, PAYRUN);
  assert.ok(found);
  assert.equal(found.payslip.owner, '0x0EcaaFc1Bd6f7033d6eb038d8Cbc8a55f900D4B1');
  assert.deepEqual(found.payslip.lines.map((l) => l.amount), [700_000_000n, 800_000_000n]);
  assert.equal(found.payslip.minRate, 1_427_846_219n);
  assert.equal(found.signature.length, 132, 'a 65-byte ECDSA signature');
  assert.equal(payslipFromRunTx('0x1234', PAYRUN), null);
});

test('E-010: PayRun’s own events say what it paid', () => {
  const { ran, paid } = runEvents(E010.receipt.logs.map((l) => ({ ...l, blockNumber: BigInt(l.blockNumber as unknown as string), logIndex: Number(l.logIndex), transactionIndex: Number(l.transactionIndex) })) as Log[], PAYRUN);
  assert.ok(ran);
  assert.equal(ran.usdtSpent, 1_040_028n);
  assert.equal(ran.cngnReceived, 1_500_000_000n);
  assert.equal(ran.lines, 2n);
  assert.deepEqual(paid.map((x) => [x.line, x.amount]), [[0n, 700_000_000n], [1n, 800_000_000n]]);
});

const DEMO = JSON.parse(readFileSync(new URL('../../../docs/evidence/demo-payslip.json', import.meta.url), 'utf8'), (k, v) =>
  ['amount', 'maxUsdtIn', 'minRate', 'deadline'].includes(k) ? BigInt(v) : v) as { payslip: Parameters<typeof judge>[2]; signature: Hex };

test('live: PayRun judges payslips itself (a free eth_call against mainnet)', { skip: process.env.CELO_LIVE !== '1' }, async () => {
  const pub = createPublicClient({ chain: celo, transport: http(process.env.CELO_RPC_URL ?? 'https://forno.celo.org') });
  const verdict = async (p: Parameters<typeof judge>[2], sig: Hex) => {
    const v = await judge(pub, PAYRUN, p, sig);
    return v.ok ? 'ok' : v.error;
  };
  // The demo payslip (owner-signed, budget 0.000001 USD₮, deadline after judging) passes; with a stranger added, NotSigned.
  assert.equal(await verdict(DEMO.payslip, DEMO.signature), 'ok');
  assert.equal(await verdict({ ...DEMO.payslip, lines: [...DEMO.payslip.lines, { to: STRANGER as Hex, amount: 10_000_000n }] }, DEMO.signature), 'NotSigned');
  assert.equal(await verdict({ ...DEMO.payslip, lines: [DEMO.payslip.lines[0]!, { ...DEMO.payslip.lines[1]!, amount: 800_000_001n }] }, DEMO.signature), 'NotSigned');
  // E-010's own payslip ran with a one-hour deadline: PayRun checks the date before the signature.
  const e010 = payslipFromRunTx(E010.transaction.input, PAYRUN)!;
  assert.equal(await verdict({ ...e010.payslip, lines: [...e010.payslip.lines, { to: STRANGER as Hex, amount: 10_000_000n }] }, e010.signature), 'Expired');
});
