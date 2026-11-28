// The agent tries to act on the owner's wallet: it asks Altana's relay to prepare its usual PayRun.run call (the
// owner's signed demo payslip, a budget of 1 unit, so it could never pay) under its session, signs it and simulates
// it against the Orchestrator. Nothing is sent. With a live session the call reaches PayRun and PayRun answers;
// after the owner stops the agent, the wallet refuses the key before anything reaches PayRun.
//   node --env-file=.env scripts/agent-tries.ts <label>      writes docs/evidence/agent-tries-<label>-<time>.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, encodeFunctionData, http, parseAbi, type Hex } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { deserializeSession, signerFromPrivateKey } from '@altananetwork/sdk';
import { selfRelay, SimulationRefused } from '../src/relay.ts';
import { payRunAbi } from '../src/abi.ts';

const label = process.argv[2] ?? 'check';
const KEY_HASH: Hex = '0x655198e5d3b27ac148df494a3b87f73f2aeba50bcfaa838c9c126e7216df4750';
const transport = http(process.env.CELO_RPC_URL ?? 'https://forno.celo.org', { retryCount: 3 });
const pub = createPublicClient({ chain: celo, transport });
const agent = createWalletClient({ account: privateKeyToAccount(process.env.AGENT_KEY as Hex), chain: celo, transport });
const session = deserializeSession(JSON.parse(readFileSync(new URL('../.session.json', import.meta.url), 'utf8')), signerFromPrivateKey(process.env.SESSION_KEY as Hex));
const demo = JSON.parse(readFileSync(new URL('../../web/app/lib/demo-payslip.json', import.meta.url), 'utf8'));
const p = { ...demo.payslip, lines: demo.payslip.lines.map((l: { to: Hex; amount: string }) => ({ to: l.to, amount: BigInt(l.amount) })), maxUsdtIn: BigInt(demo.payslip.maxUsdtIn), minRate: BigInt(demo.payslip.minRate), deadline: BigInt(demo.payslip.deadline) };
const data = encodeFunctionData({ abi: payRunAbi, functionName: 'run', args: [p, demo.signature as Hex, 1n, '0x0d7a16c3'] });

const block = await pub.getBlockNumber();
const key = await pub.readContract({ address: session.walletAddress, abi: parseAbi(['function getKey(bytes32) view returns ((uint40 expiry, uint8 keyType, bool isSuperAdmin, bytes publicKey))']), functionName: 'getKey', args: [KEY_HASH] })
  .then((k) => ({ onWallet: true, expiry: new Date(Number(k.expiry) * 1000).toISOString() }), (e: Error) => ({ onWallet: false, error: e.message.match(/reverted: (\w+)/)?.[1] ?? e.message.slice(0, 120) }));
let answer: string;
try {
  const r = await selfRelay({ pub, agent, session, sessionPrivateKey: process.env.SESSION_KEY as Hex, calls: [{ to: demo.payRun, data }], feeToken: '0x0000000000000000000000000000000000000000', send: false });
  answer = `simulated without error (${r.simulatedErr})`;
} catch (e) {
  const m = (e as Error).message;
  answer = e instanceof SimulationRefused ? `Orchestrator refused in simulation: ${e.simulatedErr}` : (m.match(/Reason: [^\n]*/)?.[0] ?? m.match(/Details: [^\n]*/)?.[0] ?? m.slice(0, 300));
}
const out = { label, checkedAt: new Date().toISOString(), block: block.toString(), wallet: session.walletAddress, keyHash: KEY_HASH, agentKey: key, attempted: 'PayRun.run (owner-signed demo payslip, budget 1 unit), prepared and simulated through Altana relay; nothing sent', answer };
const file = new URL(`../../../docs/evidence/agent-tries-${label}-${out.checkedAt.replace(/[:.]/g, '-')}.json`, import.meta.url);
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
