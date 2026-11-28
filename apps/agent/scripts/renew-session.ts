// Renews the agent's session on the owner wallet: the same session key, permitted only PayRun.run, with a new
// expiry. The key is already in the KeyStore, so only the account authorization is renewed: a relay fee, no KeyStore fee. Owner action through
// Altana's relay (untagged, D-006). Writes the session (no key) to .session.json for SESSION_JSON.
//   node --env-file=.env scripts/renew-session.ts            quote only, sends nothing
//   node --env-file=.env scripts/renew-session.ts --live     renew (spends the quoted CELO)
import { writeFileSync } from 'node:fs';
import { formatUnits, type Address, type Hex } from 'viem';
import { CELO, formatQuoteLine, NATIVE_TOKEN, serializeSession, signerFromPrivateKey } from '@altananetwork/sdk';
import { altana, payRunPermissions } from '../src/session.ts';

const PAYRUN = process.env.PAYRUN_ADDRESS as Address;
const EXPIRY = Math.floor(Date.parse('2027-01-21T09:00:00Z') / 1000);
const owner = signerFromPrivateKey(process.env.OWNER_KEY as Hex);
const args = {
  wallet: { address: owner.address },
  signer: owner,
  sessionSigner: signerFromPrivateKey(process.env.SESSION_KEY as Hex),
  permissions: payRunPermissions(PAYRUN),
  expiry: EXPIRY,
  feeToken: NATIVE_TOKEN,
  // The SDK's default fee cap is one CELO a day, below two runs' relay fees (CONTEXT); keep the 3 CELO/day the owner set.
  feeSpendLimit: 3_000_000_000_000_000_000n,
  chainId: 42220,
  // The key is still in Altana's KeyStore from its first registration (a second write reverts "key already
  // registered"); only the account's authorization expired, so re-authorize on the account alone.
  register: false,
} as const;
const client = altana();
const q = await client.quoteGrantSession(args);
console.log('quote:', q.lines.map((l) => formatQuoteLine(l, CELO)).join(' | '), '· complete', q.complete, '· needs', formatUnits(q.lines.reduce((s, l) => s + l.needed, 0n), 18), 'CELO');
if (!process.argv.includes('--live')) process.exit(0);
const session = await client.grantSession(args);
const json = JSON.stringify(serializeSession(session), (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
writeFileSync(new URL('../.session.json', import.meta.url), json);
console.log('renewed until', new Date(session.expiry * 1000).toISOString(), 'tx', (session as { transactionHash?: Hex }).transactionHash);
