// Display-only formatting for the desk (client-safe). Money stays bigint base units (6 decimals) everywhere else;
// these strings are never parsed back into a transaction.
const D = 6n;

/** Base units to "1,442.27" (two places, half up). */
export function money(units: bigint): string {
  const cents = (units * 100n + 10n ** D / 2n) / 10n ** D;
  return `${(cents / 100n).toLocaleString('en-US')}.${(cents % 100n).toString().padStart(2, '0')}`;
}

/** cNGN received per 1 USD₮ spent, in base units (the unit PayRun's minRate is signed in). */
export const rateOf = (cngn: bigint, usdt: bigint) => (usdt === 0n ? 0n : (cngn * 10n ** D) / usdt);

export const short = (hex: string) => `${hex.slice(0, 6)}…${hex.slice(-4)}`;
export const celoscanTx = (h: string) => `https://celoscan.io/tx/${h}`;
export const celoscanAddr = (a: string) => `https://celoscan.io/address/${a}`;

export function wat(d: Date): string {
  return d.toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: false });
}
export function watDay(d: Date): string {
  return d.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short' });
}

/** "1,500" or "1,500.5" typed by a person → base units, or null when it isn't a positive amount with ≤ 2 decimals. */
export function parseNaira(s: string): bigint | null {
  const t = s.replace(/[,\s₦]/g, '');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(t)) return null;
  const [w, f = ''] = t.split('.');
  const units = BigInt(w!) * 10n ** D + BigInt((f + '000000').slice(0, 6));
  return units > 0n ? units : null;
}

/** "21 Jan 2027": a date that matters beyond this week carries its year. */
export function watDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' });
}
