// Builds the one call the agent's session may make: PayRun.run(payslip, ownerSignature, usdtIn, swapData). Every
// check PayRun will make that can be made beforehand is made here first, so a doomed run is a sentence to the owner,
// not a failed transaction. PayRun still makes every check itself on-chain.
import { encodeFunctionData, type Address, type Hex } from 'viem';
import { payRunAbi } from './abi.ts';
import { owed, validatePayslip, type Payslip } from './payslip.ts';
import { checkQuoteForRun, type FirmQuote } from './textile.ts';
import type { Call } from './relay.ts';

export class RunRefused extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join(' '));
    this.problems = problems;
  }
}

/** The PayRun.run call for a signed payslip and a firm quote whose taker is `payRun`. */
export function buildRunCall(args: {
  payRun: Address;
  payslip: Payslip;
  ownerSignature: Hex;
  quote: FirmQuote;
  nowSeconds: bigint;
}): Call {
  const { payslip: p, quote: q } = args;
  const problems = [...validatePayslip(p, args.nowSeconds), ...checkQuoteForRun(q, p.maxUsdtIn)];
  // The quote's own figures, checked against the signed floor and the lines owed. PayRun re-measures both from real
  // balances; this only catches a quote that is already short.
  if (q.buyAmount * 1_000_000n < p.minRate * q.takerPays) problems.push('The quote is below the minimum rate the owner signed.');
  if (q.buyAmount < owed(p)) problems.push('The quote buys less cNGN than the payslip pays out.');
  if (problems.length > 0) throw new RunRefused(problems);

  return {
    to: args.payRun,
    data: encodeFunctionData({ abi: payRunAbi, functionName: 'run', args: [p, args.ownerSignature, q.takerPays, q.swap.data] }),
    value: 0n,
  };
}
