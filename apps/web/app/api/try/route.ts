// The public refusal check: anyone can ask PayRun, live on Celo mainnet, whether it would pay a stranger added to a
// payslip the owner signed. It is an eth_call: nothing is signed, sent or spent. The payslip is the owner's demo
// payslip (docs/evidence/demo-payslip.json), whose budget of 0.000001 USD₮ means it can never pay anyone.
import { NextResponse } from 'next/server';
import { type Hex } from 'viem';
import { judge } from '../../agent/runner.ts';
import { payslipDigest } from '../../agent/payslip.ts';
import { PAYRUN_ADDRESS, publicClient } from '../../lib/agent-env.ts';
import { payslipFromJson, payslipToJson, toJson } from '../../lib/payslip-json.ts';
import demo from '../../lib/demo-payslip.json';
import { STRANGER } from '../../lib/payees.ts';

export const dynamic = 'force-dynamic';

export async function POST() {
  const signed = payslipFromJson(demo.payslip);
  const signature = demo.signature as Hex;
  const tampered = { ...signed, lines: [...signed.lines, { to: STRANGER, amount: 10_000_000n }] };
  const pub = publicClient();
  try {
    const [block, asSigned, withStranger] = await Promise.all([
      pub.getBlockNumber(),
      judge(pub, PAYRUN_ADDRESS, signed, signature),
      judge(pub, PAYRUN_ADDRESS, tampered, signature),
    ]);
    return NextResponse.json(toJson({
      checkedAt: new Date().toISOString(),
      block,
      payRun: PAYRUN_ADDRESS,
      signed: { payslip: payslipToJson(signed), digest: payslipDigest(PAYRUN_ADDRESS, signed), verdict: asSigned.ok ? 'accepted' : asSigned.error },
      tampered: {
        added: { to: STRANGER, amount: '10000000' },
        digest: payslipDigest(PAYRUN_ADDRESS, tampered),
        verdict: withStranger.ok ? 'accepted' : withStranger.error,
        sentence: withStranger.ok ? null : withStranger.sentence,
        revertData: withStranger.ok ? null : (withStranger.revertData ?? null),
      },
    }));
  } catch {
    return NextResponse.json({ error: 'Celo did not answer; nothing was checked.' }, { status: 503 });
  }
}
