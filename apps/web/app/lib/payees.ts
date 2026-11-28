// The agency's payee book: who each wallet belongs to, as the owner would write it on a payslip. Names are not on
// chain (PayRun pays addresses), so they live here and, for the owner's own browser, in the editor's local book.
// Every entry is true: these two are Albashi's own test wallets (docs/EVIDENCE.md E-010, E-016); a real agency's
// freelancers are added by name when they join.
import { getAddress, type Address } from 'viem';

export const PAYEES: Record<Address, string> = {
  [getAddress('0xBAa4A23304101524f849935C5038073fF1cAE33b')]: 'Test payee A',
  [getAddress('0x57f0A680179e239Ed8E60f732651840E080458E8')]: 'Test payee B',
};

/** The address the public refusal check adds to the owner's signed demo payslip (apps/web/app/api/try). */
export const STRANGER: Address = getAddress('0x155720001349A7EB406d5450a21375794a0fddF2');
