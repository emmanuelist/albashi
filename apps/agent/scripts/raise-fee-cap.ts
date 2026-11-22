// Raises the agent session's daily relay-fee cap (native CELO) on the owner wallet. The owner EOA calls its own
// account (EIP-7702: msg.sender == address(this) passes onlyThis), tagged. The session may still call only PayRun.run.
//   node --env-file=.env scripts/raise-fee-cap.ts 3          simulate only
//   node --env-file=.env scripts/raise-fee-cap.ts 3 --live   send
import { writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, encodeFunctionData, http, parseAbi, parseEther, type Hex } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toDataSuffix, verifyTx } from '@celo/attribution-tags';

const KEY_HASH: Hex = '0x655198e5d3b27ac148df494a3b87f73f2aeba50bcfaa838c9c126e7216df4750';
const DAY = 2; // GuardedExecutor.SpendPeriod.Day (spendInfos reports the session's caps with period 2)
const celoPerDay = process.argv[2] ?? '3';
const transport = http('https://forno.celo.org');
const pub = createPublicClient({ chain: celo, transport });
const owner = privateKeyToAccount(process.env.OWNER_KEY as Hex);
const wallet = createWalletClient({ account: owner, chain: celo, transport, dataSuffix: toDataSuffix(process.env.ATTRIBUTION_CODE!) });
const abi = parseAbi([
  'function setSpendLimit(bytes32 keyHash, address token, uint8 period, uint256 limit)',
  'function spendInfos(bytes32 keyHash) view returns ((address token, uint8 period, uint256 limit, uint256 spent, uint256 lastUpdated, uint256 currentSpent, uint256 current)[] results)',
]);
const data = encodeFunctionData({ abi, functionName: 'setSpendLimit', args: [KEY_HASH, '0x0000000000000000000000000000000000000000', DAY, parseEther(celoPerDay)] });
await pub.call({ account: owner.address, to: owner.address, data });
console.log(`simulated: fee cap → ${celoPerDay} CELO/day`);
if (!process.argv.includes('--live')) process.exit(0);
const hash = await wallet.sendTransaction({ to: owner.address, data });
const rc = await pub.waitForTransactionReceipt({ hash });
let attribution = null;
for (let i = 0; i < 10 && !attribution; i++) { attribution = await verifyTx({ client: pub, hash }).catch(() => null); if (!attribution) await new Promise((r) => setTimeout(r, 1500)); }
const caps = await pub.readContract({ address: owner.address, abi, functionName: 'spendInfos', args: [KEY_HASH], blockTag: 'pending' });
const out = { label: 'E-015-fee-cap-raised', hash, status: rc.status, gasUsed: rc.gasUsed, effectiveGasPrice: rc.effectiveGasPrice, attribution, caps };
const j = JSON.stringify(out, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
writeFileSync(new URL(`../../../docs/evidence/E-015-fee-cap-raised-${hash.slice(0, 8)}.json`, import.meta.url), j);
console.log(j);
