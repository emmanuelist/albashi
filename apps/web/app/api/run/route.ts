// Runs a payslip the owner signed in the browser. The agent (keys in this deployment's environment) asks PayRun to
// judge it, gets a Textile quote, and self-relays the run under the owner's session. The response streams one JSON
// line per real step (judged, quoted, sent), then the outcome read from the mined receipt (AGENTS.md rule 7). Only a
// payslip its owner signed, for an owner whose session the agent holds, can run; anything else comes back as a
// sentence, with nothing sent.
import { isHex, type Hex } from 'viem';
import { runPayslip, type RunStage } from '../../agent/runner.ts';
import type { Payslip } from '../../agent/payslip.ts';
import { agentConfig, PAYRUN_ADDRESS } from '../../lib/agent-env.ts';
import { payslipFromJson, toJson } from '../../lib/payslip-json.ts';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const line = (x: unknown) => new TextEncoder().encode(JSON.stringify(toJson(x)) + '\n');

export async function POST(req: Request) {
  const cfg = agentConfig();
  if ('missing' in cfg) {
    return Response.json({ status: 'unavailable', sentence: `The agent isn't configured on this deployment (missing ${cfg.missing.join(', ')}).` }, { status: 503 });
  }
  let payslip: Payslip, signature: Hex;
  try {
    const body = (await req.json()) as { payslip?: unknown; signature?: unknown };
    payslip = payslipFromJson(body.payslip);
    if (!isHex(body.signature)) throw new Error('signature must be hex');
    signature = body.signature;
  } catch (e) {
    return Response.json({ status: 'refused', stage: 'agent', error: 'BadRequest', sentence: (e as Error).message }, { status: 400 });
  }
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const outcome = await runPayslip({ ...cfg, payRun: PAYRUN_ADDRESS, payslip, signature, onStage: (s: RunStage) => controller.enqueue(line(s)) });
        controller.enqueue(line({ stage: 'done', outcome }));
      } catch (e) {
        controller.enqueue(line({ stage: 'done', outcome: { status: 'error', sentence: `The run stopped before anything was confirmed: ${(e as Error).message.slice(0, 240)}` } }));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
