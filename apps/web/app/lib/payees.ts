// The agency's payee book: who each wallet belongs to, as the owner would write it on a payslip. Names are not on
// chain (PayRun pays addresses), so they live here and, for the owner's own browser, in the editor's local book.
// Every entry is true: the two test payees are Albashi's own wallets (docs/EVIDENCE.md E-010, E-016); a real
// freelancer is added by the name they chose, with their consent.
import { getAddress, type Address } from 'viem';

export const PAYEES: Record<Address, string> = {
  [getAddress('0xBAa4A23304101524f849935C5038073fF1cAE33b')]: 'Test payee A',
  [getAddress('0x57f0A680179e239Ed8E60f732651840E080458E8')]: 'Test payee B',
  // The first real freelancer: a photographer in Surulere, Lagos (his public business name), 28 Nov.
  [getAddress('0xFF8175D609814fb3a9A2e0Bc10D5ac8e36f48D79')]: 'Tommy Braz (photography)',
};

/** The address the public refusal check adds to the owner's signed demo payslip (apps/web/app/api/try). */
export const STRANGER: Address = getAddress('0x155720001349A7EB406d5450a21375794a0fddF2');

/** Who pays: the owner wallets Albashi knows by name. This one is the Albashi team's own agency wallet (STATE, D-012). */
export const PAYERS: Record<Address, string> = {
  [getAddress('0x0EcaaFc1Bd6f7033d6eb038d8Cbc8a55f900D4B1')]: 'Albashi team',
};
