// The payslip the owner signs, mirroring PayRun's EIP-712 types exactly (contracts/src/PayRun.sol). Money is
// bigint in token base units end to end (USD₮ and cNGN are 6 decimals). No model decides any of these values:
// they come from what the owner entered and signed (AGENTS.md rules 5 and 6).
import { hashTypedData, type Address, type Hex, type LocalAccount } from 'viem';

export const CELO_CHAIN_ID = 42220;

export type Line = { to: Address; amount: bigint };

export type Payslip = {
  owner: Address;
  lines: Line[];
  /** The most USD₮ (base units) the run may pull. */
  maxUsdtIn: bigint;
  /** The lowest rate accepted: cNGN base units per 1 USD₮ (1e6 base units). */
  minRate: bigint;
  /** Unix seconds. */
  deadline: bigint;
  salt: Hex;
};

export const payslipTypes = {
  Payslip: [
    { name: 'owner', type: 'address' },
    { name: 'lines', type: 'Line[]' },
    { name: 'maxUsdtIn', type: 'uint256' },
    { name: 'minRate', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
    { name: 'salt', type: 'bytes32' },
  ],
  Line: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
} as const;

export function payslipDomain(payRun: Address, chainId: number = CELO_CHAIN_ID) {
  return { name: 'Albashi PayRun', version: '1', chainId, verifyingContract: payRun } as const;
}

/** The digest PayRun.hashPayslip returns for the same payslip, contract and chain. */
export function payslipDigest(payRun: Address, p: Payslip, chainId: number = CELO_CHAIN_ID): Hex {
  return hashTypedData({ domain: payslipDomain(payRun, chainId), types: payslipTypes, primaryType: 'Payslip', message: p });
}

/** The owner signs with their own key; PayRun accepts this ECDSA signature even on an EIP-7702 account. */
export async function signPayslip(owner: LocalAccount, payRun: Address, p: Payslip, chainId: number = CELO_CHAIN_ID): Promise<Hex> {
  if (owner.address.toLowerCase() !== p.owner.toLowerCase()) throw new Error('the signer is not the payslip owner');
  return owner.signTypedData({ domain: payslipDomain(payRun, chainId), types: payslipTypes, primaryType: 'Payslip', message: p });
}

/** Sum of every line, in cNGN base units. */
export function owed(p: Payslip): bigint {
  return p.lines.reduce((sum, line) => sum + line.amount, 0n);
}

/**
 * Checks a payslip before anyone signs it, with the same rules PayRun enforces on-chain, so the owner sees a
 * mistake as a sentence instead of a reverted transaction.
 */
export function validatePayslip(p: Payslip, nowSeconds: bigint): string[] {
  const problems: string[] = [];
  if (p.lines.length === 0) problems.push('The payslip has no lines.');
  if (p.lines.length > 100) problems.push('A payslip holds at most 100 lines.');
  p.lines.forEach((line, i) => {
    if (/^0x0{40}$/i.test(line.to)) problems.push(`Line ${i + 1} has no recipient.`);
    if (line.amount <= 0n) problems.push(`Line ${i + 1} pays nothing.`);
  });
  if (p.maxUsdtIn <= 0n) problems.push('The USD₮ budget is zero.');
  if (p.minRate <= 0n) problems.push('The minimum rate is zero.');
  if (p.deadline <= nowSeconds) problems.push('The deadline has passed.');
  // At the floor rate, the budget must buy enough cNGN for every line, or no quote can ever satisfy it.
  if (p.minRate > 0n && p.maxUsdtIn * p.minRate < owed(p) * 1_000_000n) {
    problems.push('At the minimum rate, the USD₮ budget cannot buy enough cNGN for every line.');
  }
  return problems;
}
