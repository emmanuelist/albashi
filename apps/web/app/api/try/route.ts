// The public refusal check: anyone can ask PayRun, live on Celo mainnet, whether it would pay a stranger added to a
// payslip the owner signed. It is an eth_call: nothing is signed, sent or spent. The payslip is the owner's demo
// payslip (docs/evidence/demo-payslip.json), whose budget of 0.000001 USD₮ means it can never pay anyone.
import { NextResponse } from 'next/server';
import { BaseError, decodeErrorResult, encodeFunctionData, type Hex } from 'viem';
import { payRunAbi } from '../../agent/abi.ts';
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
    // Third check: the stranger sends the owner's own signed payslip themselves. PayRun refuses any sender but the owner.
    const byStranger = pub
      .call({ account: STRANGER, to: PAYRUN_ADDRESS, data: encodeFunctionData({ abi: payRunAbi, functionName: 'run', args: [signed, signature, 1n, '0x0d7a16c3'] }) })
      .then(() => 'accepted', (e: unknown) => {
        const found = e instanceof BaseError ? (e.walk((x) => typeof (x as { data?: unknown }).data === 'string') as { data?: Hex } | null) : null;
        try { return found?.data ? decodeErrorResult({ abi: payRunAbi, data: found.data }).errorName : 'Unreadable'; } catch { return 'Unreadable'; }
      });
    const [block, asSigned, withStranger, strangerSends] = await Promise.all([
      pub.getBlockNumber(),
      judge(pub, PAYRUN_ADDRESS, signed, signature),
      judge(pub, PAYRUN_ADDRESS, tampered, signature),
      byStranger,
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
      strangerSends: { from: STRANGER, verdict: strangerSends },
    }));
  } catch {
    return NextResponse.json({ error: 'Celo did not answer; nothing was checked.' }, { status: 503 });
  }
}
