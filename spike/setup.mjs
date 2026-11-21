// Generates the spike's throwaway keys into .env (mode 600). Never run twice over an existing .env.
// ADMIN_KEY   = the Altana wallet's admin key. With EIP-7702 the wallet address IS this key's address.
// SESSION_KEY = the agent's session key (granted, capped, then revoked during the spike).
// RECIPIENT   = a second wallet that receives the cNGN payout (stands in for a freelancer).
import { existsSync, writeFileSync } from 'node:fs';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

if (existsSync('.env')) {
  console.error('.env already exists; refusing to overwrite keys that may hold funds.');
  process.exit(1);
}
const admin = generatePrivateKey();
const session = generatePrivateKey();
const recipient = generatePrivateKey();
writeFileSync(
  '.env',
  [
    `ADMIN_KEY=${admin}`,
    `SESSION_KEY=${session}`,
    `RECIPIENT_KEY=${recipient}`,
    `# Your ERC-8021 code from the hackathon enrolment (leave empty to send untagged)`,
    `ATTRIBUTION_CODE=`,
    '',
  ].join('\n'),
  { mode: 0o600 },
);
console.log('Wallet (fund this):', privateKeyToAccount(admin).address);
console.log('Recipient (stand-in freelancer):', privateKeyToAccount(recipient).address);
