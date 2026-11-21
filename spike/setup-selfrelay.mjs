// Generates the self-relay spike's throwaway keys into .env.selfrelay (mode 600, gitignored by `.env.*`).
// OWNER_KEY  = the test Altana wallet's admin key (under EIP-7702 the wallet address is this key's address)
// SESSION_KEY = the agent's session key on that wallet
// AGENT_KEY  = the agent's own EOA: it self-relays the signed intents to the Orchestrator and pays their gas
import { existsSync, writeFileSync } from 'node:fs';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const file = '.env.selfrelay';
const payoutTo = process.argv[2]; // where the cNGN payout goes, e.g. your own wallet: node setup-selfrelay.mjs 0x…
if (!/^0x[0-9a-fA-F]{40}$/.test(payoutTo ?? '')) {
  console.error('usage: node setup-selfrelay.mjs <payout address>');
  process.exit(1);
}
if (existsSync(file)) {
  console.error(`${file} already exists; refusing to overwrite keys that may hold funds.`);
  process.exit(1);
}
const owner = generatePrivateKey(), session = generatePrivateKey(), agent = generatePrivateKey();
writeFileSync(file, [
  `OWNER_KEY=${owner}`,
  `SESSION_KEY=${session}`,
  `AGENT_KEY=${agent}`,
  `ATTRIBUTION_CODE=celo_3f5cac8c49f6`,
  `PAYOUT_TO=${payoutTo}`,
  '',
].join('\n'), { mode: 0o600 });
console.log('Owner wallet (fund: ~22 CELO + 2 USD₮):', privateKeyToAccount(owner).address);
console.log('Agent EOA    (fund: ~0.5 CELO for gas): ', privateKeyToAccount(agent).address);
