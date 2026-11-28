// Read-only: checks Albashi's two decisive transactions on Celo mainnet. No wallet, no keys.
//   cd spike && npm ci && node verify.mjs
// E-018: the agent paid a real freelancer exactly the line the owner signed, tagged.
// E-019: the owner stopped the agent from the desk in one transaction (revoke of its key).
import { createPublicClient, http, decodeEventLog, erc20Abi, formatUnits, getAddress, parseAbi } from 'viem';
import { celo } from 'viem/chains';
import { verifyTx } from '@celo/attribution-tags';

const RUN = '0xfe750155a452f2ee358a6983165e9f5b544b59ba0c8baeb4a888f3637b0c9889';    // E-018
const REVOKE = '0x0fd2eb83f29afa64940df3cbf08af305fc89d49d100ecb9672251b50d8256341'; // E-019
const ORCHESTRATOR = '0xaf140d0416a994aebb3fa6212b16ce6700f09751'; // Altana's (Porto) Orchestrator on Celo
const AGENT = '0x1Bce3F6267983dfAb58CED6261EF05a28E168ce8';        // the agent wallet on file (ERC-8004 agent 10095)
const OWNER = '0x0EcaaFc1Bd6f7033d6eb038d8Cbc8a55f900D4B1';        // the agency owner's Altana wallet
const PAYRUN = '0xfa8d963525d5F28427B897A0C761C744A43e59Af';       // the pay-run contract
const FREELANCER = '0xFF8175D609814fb3a9A2e0Bc10D5ac8e36f48D79';   // Tommy Braz, photographer
const CNGN = '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f';
const CODE = 'celo_3f5cac8c49f6';
const REVOKE_SELECTOR = '0xb75c7dc6'; // revoke(bytes32) on the owner's Altana account

const pub = createPublicClient({ chain: celo, transport: http('https://forno.celo.org', { retryCount: 4 }) });
const [tx, receipt, tag, rtx, rreceipt] = await Promise.all([
  pub.getTransaction({ hash: RUN }), pub.getTransactionReceipt({ hash: RUN }), verifyTx({ client: pub, hash: RUN }),
  pub.getTransaction({ hash: REVOKE }), pub.getTransactionReceipt({ hash: REVOKE }),
]);

const toFreelancer = receipt.logs
  .filter((l) => getAddress(l.address) === getAddress(CNGN))
  .map((l) => decodeEventLog({ abi: erc20Abi, data: l.data, topics: l.topics }))
  .filter((e) => e.eventName === 'Transfer' && getAddress(e.args.from) === getAddress(PAYRUN) && getAddress(e.args.to) === getAddress(FREELANCER))
  .reduce((s, e) => s + e.args.value, 0n);

const checks = [
  ['E-018 sent by the agent wallet on file', getAddress(tx.from) === getAddress(AGENT), tx.from],
  ['E-018 sent to Altana\'s Orchestrator, acting as the owner\'s wallet', getAddress(tx.to) === getAddress(ORCHESTRATOR), tx.to],
  ['E-018 mined successfully', receipt.status === 'success', `block ${receipt.blockNumber}`],
  [`E-018 attribution tag ${CODE} at the end of the calldata`, Boolean(tag?.codes?.includes(CODE)), JSON.stringify(tag)],
  ['E-018 the pay-run contract paid the freelancer ₦1,500 in cNGN', toFreelancer === 1_500_000_000n, `${formatUnits(toFreelancer, 6)} cNGN to ${FREELANCER}`],
  ['E-019 the owner\'s wallet called revoke on itself', getAddress(rtx.from) === getAddress(OWNER) && getAddress(rtx.to) === getAddress(OWNER) && rtx.input.startsWith(REVOKE_SELECTOR), `${rtx.input.slice(0, 10)} from ${rtx.from}`],
  ['E-019 mined successfully', rreceipt.status === 'success', `block ${rreceipt.blockNumber}`],
];
// The agent's key was given back afterwards (E-019), so "stopped" is proven by the revoke itself, not by today's state.
const key = await pub.readContract({ address: OWNER, abi: parseAbi(['function getKey(bytes32) view returns ((uint40 expiry, uint8 keyType, bool isSuperAdmin, bytes publicKey))']), functionName: 'getKey', args: ['0x655198e5d3b27ac148df494a3b87f73f2aeba50bcfaa838c9c126e7216df4750'], blockNumber: rreceipt.blockNumber })
  .then(() => 'present', (e) => (/e57b6304|KeyDoesNotExist/.test(String(e?.message)) ? 'gone' : 'unreadable'));
checks.push(['E-019 the agent\'s key was gone right after the revoke', key === 'gone', `getKey at block ${rreceipt.blockNumber}: ${key}`]);

for (const [what, ok, detail] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}  (${detail})`);
process.exit(checks.every((c) => c[1]) ? 0 : 1);
