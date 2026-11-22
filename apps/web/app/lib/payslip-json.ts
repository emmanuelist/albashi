// Payslips cross the wire as JSON, so base-unit amounts travel as decimal strings and become bigint here. Nothing is
// rounded: a value that isn't a whole number of base units is rejected.
import { getAddress, isHex, type Hex } from 'viem';
import type { Payslip } from '../agent/payslip.ts';

const uint = (v: unknown, what: string): bigint => {
  if (typeof v !== 'string' || !/^\d{1,40}$/.test(v)) throw new Error(`${what} must be a whole number of base units`);
  return BigInt(v);
};

export function payslipFromJson(j: unknown): Payslip {
  const o = j as Record<string, unknown>;
  if (!o || !Array.isArray(o.lines)) throw new Error('payslip.lines is missing');
  if (!isHex(o.salt) || (o.salt as string).length !== 66) throw new Error('payslip.salt must be 32 bytes of hex');
  return {
    owner: getAddress(String(o.owner)),
    lines: o.lines.map((l: Record<string, unknown>, i: number) => ({ to: getAddress(String(l.to)), amount: uint(l.amount, `line ${i + 1} amount`) })),
    maxUsdtIn: uint(o.maxUsdtIn, 'maxUsdtIn'),
    minRate: uint(o.minRate, 'minRate'),
    deadline: uint(o.deadline, 'deadline'),
    salt: o.salt as Hex,
  };
}

export function payslipToJson(p: Payslip) {
  return {
    owner: p.owner,
    lines: p.lines.map((l) => ({ to: l.to, amount: l.amount.toString() })),
    maxUsdtIn: p.maxUsdtIn.toString(),
    minRate: p.minRate.toString(),
    deadline: p.deadline.toString(),
    salt: p.salt,
  };
}

/** JSON.stringify that writes bigints as decimal strings. */
export const toJson = (x: unknown) => JSON.parse(JSON.stringify(x, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
