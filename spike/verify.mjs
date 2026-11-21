// Read-only: checks Albashi's self-relayed transaction (E-005) on Celo mainnet. No wallet, no keys.
//   cd spike && npm ci && node verify.mjs
import { createPublicClient, http, decodeEventLog, erc20Abi, formatUnits, getAddress } from 'viem';
import { celo } from 'viem/chains';
import { verifyTx } from '@celo/attribution-tags';

const HASH = '0x6272cb58f29012a94b6ed19a486c24f3e4887ca4ad2418c296d4500e4d0130c5';
const ORCHESTRATOR = '0xaf140d0416a994aebb3fa6212b16ce6700f09751'; // Altana's (Porto) Orchestrator on Celo
const AGENT = '0x9Fb5a16af64eEC7A640f2Aa1c7c6aC6E89f0dc79'; // the agent EOA that self-relayed
const OWNER = '0x0EcaaFc1Bd6f7033d6eb038d8Cbc8a55f900D4B1'; // the owner's Altana wallet (test)
const CNGN = '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f';
const CODE = 'celo_3f5cac8c49f6';

const pub = createPublicClient({ chain: celo, transport: http('https://forno.celo.org') });
const [tx, receipt, tag] = await Promise.all([pub.getTransaction({ hash: HASH }), pub.getTransactionReceipt({ hash: HASH }), verifyTx({ client: pub, hash: HASH })]);

const cngnIn = receipt.logs
  .filter((l) => getAddress(l.address) === getAddress(CNGN))
  .map((l) => decodeEventLog({ abi: erc20Abi, data: l.data, topics: l.topics }))
  .filter((e) => e.eventName === 'Transfer' && getAddress(e.args.to) === getAddress(OWNER))
  .reduce((s, e) => s + e.args.value, 0n);

const checks = [
  ['sent by the agent EOA, not a relay', getAddress(tx.from) === getAddress(AGENT), tx.from],
  ['sent to the Orchestrator', getAddress(tx.to) === getAddress(ORCHESTRATOR), tx.to],
  ['mined successfully', receipt.status === 'success', `block ${receipt.blockNumber}`],
  [`attribution tag ${CODE} at the end of the calldata`, Boolean(tag?.codes?.includes(CODE)), JSON.stringify(tag)],
  ['cNGN arrived in the owner\'s Altana wallet', cngnIn > 0n, `${formatUnits(cngnIn, 6)} cNGN`],
];
for (const [what, ok, detail] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}  (${detail})`);
process.exit(checks.every((c) => c[1]) ? 0 : 1);
