// One pay run, end to end, for a payslip the owner has already signed: PayRun judges it first (a free eth_call),
// then a Textile firm quote with PayRun as the taker, then the agent self-relays PayRun.run under the owner's
// session, and the outcome is read back from the mined receipt. Used by scripts and by the web app's /api routes
// (copied there by apps/web/scripts/sync-agent.mjs; this file is the source).
import {
  BaseError, decodeAbiParameters, decodeErrorResult, decodeFunctionData, encodeFunctionData, parseEventLogs,
  type Address, type Hex, type LocalAccount, type Log,
} from 'viem';
import type { Session } from '@altananetwork/sdk';
import { payRunAbi } from './abi.ts';
import { owed, type Payslip } from './payslip.ts';
import { buildRunCall, RunRefused } from './payrun.ts';
import { EXECUTE_ABI, INTENT, selfRelay, SimulationRefused, type CeloPublicClient, type CeloWalletClient } from './relay.ts';
import { firmQuote, preview, signTakerProof, type FirmQuote } from './textile.ts';

const NATIVE: Address = '0x0000000000000000000000000000000000000000';

/** PayRun errors raised before the swap: the payslip itself, or who sent it, is wrong. */
const REFUSALS: Record<string, string> = {
  NotOwner: 'Only the owner’s own wallet can run this payslip.',
  Expired: 'This payslip’s deadline has passed.',
  BadLines: 'The payslip has no lines, too many lines, or a line with no recipient or amount.',
  AlreadyUsed: 'This payslip has already run or was cancelled; each payslip runs once.',
  NotSigned: 'The owner did not sign this payslip: a line, an amount or a limit differs from what was signed.',
  OverBudget: 'The run would spend more USD₮ than the payslip allows.',
};

/** Altana's Orchestrator returns an error code instead of reverting; the ones a pay run can meet, in words. */
export const ORCHESTRATOR_ERRORS: Record<string, string> = {
  '0x9054c912': 'The agent’s relay-fee allowance on the owner’s wallet is used up for today (ExceededSpendLimit). Nothing was sent; it resets at 00:00 UTC, or the owner raises it.',
  '0x907e849a': 'The run would pass a spend limit on the owner’s wallet (ExceededSpendLimit). Nothing was sent.',
  '0xf78c1b53': 'The agent’s session doesn’t permit this call (UnauthorizedCall). Nothing was sent.',
  '0xe57b6304': 'The agent’s session key isn’t on the owner’s wallet any more: revoked or never granted (KeyDoesNotExist). Nothing was sent.',
  '0xabab8fc9': 'The owner’s wallet couldn’t pay the relay fee (PaymentError). Nothing was sent.',
};

export type Verdict =
  | { ok: true; float: bigint }
  | { ok: false; error: string; sentence: string; revertData?: Hex };

/**
 * Asks PayRun itself whether it would accept this payslip and signature from the owner, without sending anything:
 * an eth_call of run() with a 1-unit budget and a swap that can't fill. PayRun checks the caller, deadline, lines,
 * single use and signature before it touches the float or the swap, so a revert with one of REFUSALS is its
 * verdict on the payslip; any later error means the payslip itself passed.
 */
export async function judge(pub: CeloPublicClient, payRun: Address, p: Payslip, signature: Hex): Promise<Verdict> {
  const data = encodeFunctionData({ abi: payRunAbi, functionName: 'run', args: [p, signature, 1n, '0x0d7a16c3'] });
  try {
    await pub.call({ account: p.owner, to: payRun, data });
  } catch (e) {
    const found = e instanceof BaseError ? (e.walk((x) => typeof (x as { data?: unknown }).data === 'string') as { data?: Hex } | null) : null;
    const name = found?.data ? safeErrorName(found.data) : undefined;
    if (name && name in REFUSALS) return { ok: false, error: name, sentence: REFUSALS[name]!, revertData: found?.data };
    if (!name) return { ok: false, error: 'Unreadable', sentence: 'Celo did not return a reason; nothing was sent.' };
  }
  const float = await pub.readContract({ address: payRun, abi: payRunAbi, functionName: 'float', args: [p.owner] });
  return { ok: true, float };
}

function safeErrorName(data: Hex): string | undefined {
  try {
    return decodeErrorResult({ abi: payRunAbi, data }).errorName;
  } catch {
    return undefined;
  }
}

/**
 * A firm quote with PayRun as the taker. Textile holds the taker's balance against its open quotes a little past
 * their expiry, so `insufficient_funds` is retried; each attempt signs a fresh taker proof (they go stale in minutes).
 */
export async function quoteForRun(agent: LocalAccount, payRun: Address, buyUnits: bigint, opts = { attempts: 4, delayMs: 15_000 }): Promise<FirmQuote> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await firmQuote({ taker: payRun, buyUnits, takerProof: await signTakerProof(agent, payRun) });
    } catch (e) {
      const reason = (e as { body?: { error?: { details?: { reason?: string } } } }).body?.error?.details?.reason;
      if (reason !== 'insufficient_funds' || attempt >= opts.attempts) throw e;
      await new Promise((res) => setTimeout(res, opts.delayMs));
    }
  }
}

export type RunEvents = {
  ran: { digest: Hex; owner: Address; usdtSpent: bigint; cngnReceived: bigint; cngnPaid: bigint; lines: bigint } | null;
  paid: { line: bigint; to: Address; amount: bigint }[];
};

/** PayRun's own record of a run, from a receipt's logs: the Ran event and one Paid event per signed line. */
export function runEvents(logs: Log[], payRun: Address): RunEvents {
  const mine = logs.filter((l) => l.address.toLowerCase() === payRun.toLowerCase());
  const events = parseEventLogs({ abi: payRunAbi, logs: mine });
  const ran = events.find((e) => e.eventName === 'Ran');
  return {
    ran: ran && ran.eventName === 'Ran' ? { ...ran.args } : null,
    paid: events.flatMap((e) => (e.eventName === 'Paid' ? [{ line: e.args.line, to: e.args.to, amount: e.args.amount }] : [])),
  };
}

/** The run's real progress, reported as each step completes (the web app streams these to the owner). */
export type RunStage =
  | { stage: 'judged'; float: bigint }
  | { stage: 'quoted'; takerPays: bigint; buyAmount: bigint }
  | { stage: 'sent'; hash: Hex };

export type RunOutcome =
  | { status: 'refused'; stage: 'payrun' | 'agent'; error: string; sentence: string }
  | { status: 'paid' | 'reverted'; hash: Hex; minedAt: number; quote: { takerPays: bigint; buyAmount: bigint }; events: RunEvents };

/** Runs a signed payslip. Every refusal is a sentence; a sent run is reported from its mined receipt. */
export async function runPayslip(args: {
  pub: CeloPublicClient;
  agent: CeloWalletClient;
  agentAccount: LocalAccount;
  session: Session;
  sessionPrivateKey: Hex;
  payRun: Address;
  payslip: Payslip;
  signature: Hex;
  onStage?: (s: RunStage) => void;
}): Promise<RunOutcome> {
  const report = args.onStage ?? (() => {});
  const { pub, payRun, payslip: p, signature } = args;
  if (p.owner.toLowerCase() !== args.session.walletAddress.toLowerCase()) {
    return { status: 'refused', stage: 'agent', error: 'NoSession', sentence: 'Albashi’s agent holds no session for this owner’s wallet.' };
  }
  const verdict = await judge(pub, payRun, p, signature);
  if (!verdict.ok) return { status: 'refused', stage: 'payrun', error: verdict.error, sentence: verdict.sentence };
  report({ stage: 'judged', float: verdict.float });

  // A free preview first: a firm quote holds the owner's float at Textile for minutes, so don't ask for one that the
  // payslip's own budget or floor already rules out.
  const per1 = (await preview(1_000_000n)).buyUnits;
  if ((p.maxUsdtIn * per1) / 1_000_000n < owed(p)) {
    return { status: 'refused', stage: 'agent', error: 'BudgetTooSmall', sentence: 'At today’s rate the payslip’s USD₮ budget can’t buy the naira it pays out.' };
  }
  if (per1 < p.minRate) {
    return { status: 'refused', stage: 'agent', error: 'BelowFloor', sentence: 'Today’s rate is below the minimum the owner signed; nothing was sent.' };
  }
  const quote = await quoteForRun(args.agentAccount, payRun, owed(p));
  report({ stage: 'quoted', takerPays: quote.takerPays, buyAmount: quote.buyAmount });
  if (verdict.float < quote.takerPays) {
    return { status: 'refused', stage: 'agent', error: 'InsufficientFloat', sentence: `The owner’s float holds ${verdict.float} USD₮ base units; this run needs ${quote.takerPays}.` };
  }
  let call;
  try {
    call = buildRunCall({ payRun, payslip: p, ownerSignature: signature, quote, nowSeconds: BigInt(Math.floor(Date.now() / 1000)) });
  } catch (e) {
    if (e instanceof RunRefused) return { status: 'refused', stage: 'agent', error: 'QuoteRefused', sentence: e.problems.join(' ') };
    throw e;
  }
  let sent;
  try {
    sent = await selfRelay({ pub, agent: args.agent, session: args.session, sessionPrivateKey: args.sessionPrivateKey, calls: [call], feeToken: NATIVE, send: true });
  } catch (e) {
    if (e instanceof SimulationRefused) {
      return { status: 'refused', stage: 'agent', error: e.simulatedErr, sentence: ORCHESTRATOR_ERRORS[e.simulatedErr] ?? `Altana’s Orchestrator refused the run in simulation (${e.simulatedErr}). Nothing was sent.` };
    }
    throw e;
  }
  report({ stage: 'sent', hash: sent.hash! });
  const receipt = await pub.waitForTransactionReceipt({ hash: sent.hash! });
  // A public node can serve the receipt before the block itself (seen on forno, 2026-11-22: a mined run was
  // reported as an error). The run is already confirmed, so the block's time is retried, never allowed to fail it.
  let minedAt = 0;
  for (let i = 0; i < 8 && !minedAt; i++) {
    minedAt = await pub.getBlock({ blockNumber: receipt.blockNumber }).then((b) => Number(b.timestamp), () => 0);
    if (!minedAt) await new Promise((res) => setTimeout(res, 1500));
  }
  return {
    status: receipt.status === 'success' ? 'paid' : 'reverted',
    hash: sent.hash!,
    /** Unix seconds of the block the run was mined in (0 if the node never served it): the counterfoils' time. */
    minedAt,
    quote: { takerPays: quote.takerPays, buyAmount: quote.buyAmount },
    events: runEvents(receipt.logs, payRun),
  };
}

const CALLS = [{ type: 'tuple[]', components: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }] }] as const;

/**
 * The payslip and owner signature inside a self-relayed run: the transaction's input is Orchestrator.execute(intent)
 * plus the 35-byte attribution tag, and the intent's executionData is the wallet's call batch, one of which is
 * PayRun.run(payslip, signature, usdtIn, swapData).
 */
export function payslipFromRunTx(input: Hex, payRun: Address): { payslip: Payslip; signature: Hex } | null {
  for (const body of [input, input.slice(0, input.length - 70) as Hex]) {
    try {
      const call = decodeFunctionData({ abi: EXECUTE_ABI, data: body });
      const [intent] = decodeAbiParameters([INTENT], call.args[0] as Hex);
      const [calls] = decodeAbiParameters(CALLS, intent.executionData);
      for (const c of calls) {
        if (c.to.toLowerCase() !== payRun.toLowerCase()) continue;
        const d = decodeFunctionData({ abi: payRunAbi, data: c.data });
        if (d.functionName !== 'run') continue;
        const [p, signature] = d.args;
        return { payslip: { ...p, lines: p.lines.map((l) => ({ ...l })) }, signature };
      }
    } catch {
      // not this shape; try the next
    }
  }
  return null;
}
