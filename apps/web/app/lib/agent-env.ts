// The agent's configuration on the server. Keys live only in the deployment's environment (never in the repo or the
// browser). Missing configuration is reported as such, never filled in.
import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toDataSuffix } from '@celo/attribution-tags';
import { deserializeSession, signerFromPrivateKey, type Session } from '@altananetwork/sdk';
import { ATTRIBUTION_CODE } from '../agent/relay.ts';

export const PAYRUN_ADDRESS = (process.env.PAYRUN_ADDRESS ?? '0xfa8d963525d5F28427B897A0C761C744A43e59Af') as Address;
const transport = http(process.env.CELO_RPC_URL ?? 'https://forno.celo.org', { timeout: 15_000 });

/** A read-only client: enough for PayRun's verdicts, no keys needed. */
export function publicClient() {
  return createPublicClient({ chain: celo, transport });
}

export type AgentConfig = {
  pub: ReturnType<typeof publicClient>;
  agentAccount: ReturnType<typeof privateKeyToAccount>;
  agent: ReturnType<typeof createWalletClient<typeof transport, typeof celo, ReturnType<typeof privateKeyToAccount>>>;
  session: Session;
  sessionPrivateKey: Hex;
};

/** The agent, or the names of what this deployment is missing. */
export function agentConfig(): AgentConfig | { missing: string[] } {
  const missing = ['AGENT_KEY', 'SESSION_KEY', 'SESSION_JSON'].filter((k) => !process.env[k]);
  if (missing.length) return { missing };
  const agentAccount = privateKeyToAccount(process.env.AGENT_KEY as Hex);
  const sessionPrivateKey = process.env.SESSION_KEY as Hex;
  const session = deserializeSession(JSON.parse(process.env.SESSION_JSON!), signerFromPrivateKey(sessionPrivateKey));
  // The tag goes on where the wallet client is built, so nothing the agent sends can leave without it (AGENTS.md 4).
  const agent = createWalletClient({ account: agentAccount, chain: celo, transport, dataSuffix: toDataSuffix(process.env.ATTRIBUTION_CODE ?? ATTRIBUTION_CODE) });
  return { pub: publicClient(), agentAccount, agent, session, sessionPrivateKey };
}
