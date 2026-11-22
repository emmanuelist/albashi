// A fixed payslip shared by the TypeScript test and contracts/test/PayRunDigest.t.sol. If the two digests ever
// differ, every real run would fail with NotSigned.
import type { Payslip } from '../src/payslip.ts';

export const VECTOR_PAYRUN = '0x00000000000000000000000000000000000a1ba5' as const;
export const VECTOR: Payslip = {
  owner: '0x1111111111111111111111111111111111111111',
  lines: [
    { to: '0x2222222222222222222222222222222222222222', amount: 600_000_000n },
    { to: '0x3333333333333333333333333333333333333333', amount: 800_000_000n },
  ],
  maxUsdtIn: 2_000_000n,
  minRate: 1_430_000_000n,
  deadline: 1_800_000_000n,
  salt: '0x6e6f762d70617900000000000000000000000000000000000000000000000000',
};
