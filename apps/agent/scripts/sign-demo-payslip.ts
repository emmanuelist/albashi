// Signs Albashi's demo payslip with the owner's key, for the public "try to pay someone not on the payslip" check.
// It can never pay: its USD₮ budget is one base unit (0.000001 USD₮), below any Textile quote, so the agent refuses
// it and PayRun would revert OverBudget. Its deadline is after judging, so PayRun judges the signature, not the date.
//   node --env-file=.env scripts/sign-demo-payslip.ts   (sends nothing)
import { writeFileSync } from 'node:fs';
import { keccak256, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { signPayslip, payslipDigest, type Payslip } from '../src/payslip.ts';

const PAYRUN = '0xfa8d963525d5F28427B897A0C761C744A43e59Af';
const owner = privateKeyToAccount(process.env.OWNER_KEY as Hex);
const payslip: Payslip = {
  owner: owner.address,
  lines: [
    { to: '0xBAa4A23304101524f849935C5038073fF1cAE33b', amount: 700_000_000n },
    { to: '0x57f0A680179e239Ed8E60f732651840E080458E8', amount: 800_000_000n },
  ],
  maxUsdtIn: 1n,
  minRate: 1_427_846_219n,
  deadline: BigInt(Math.floor(Date.parse('2027-06-30T00:00:00Z') / 1000)),
  salt: keccak256(toHex('albashi-demo-payslip-v1')),
};
const signature = await signPayslip(owner, PAYRUN, payslip);
const out = {
  note: 'Signed by the owner for the public refusal check. Budget 0.000001 USD₮: it can never pay anyone.',
  payRun: PAYRUN,
  digest: payslipDigest(PAYRUN, payslip),
  payslip,
  signature,
};
const json = JSON.stringify(out, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n';
for (const path of ['../../../docs/evidence/demo-payslip.json', '../../web/app/lib/demo-payslip.json']) writeFileSync(new URL(path, import.meta.url), json);
console.log(json);
