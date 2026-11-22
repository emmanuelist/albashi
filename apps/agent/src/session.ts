// The owner's side of a pay run: a USD₮ float in PayRun, and a session whose only permitted call is PayRun.run
// (D-009, D-010). The agent never holds a permission to call USD₮, cNGN or Textile directly: Altana pins a target
// and a selector but never the arguments, so any such permission could pay anyone.
//
// What limits the agent's money: PayRun spends only the float the owner deposited, and each run at most the
// payslip's signed `maxUsdtIn`. A run moves no USD₮ out of the owner's wallet, so a USD₮ spend cap on the session
// would limit nothing; the session's one spend cap is the relay-fee cap the SDK adds for the fee token.
import { encodeFunctionData, erc20Abi, type Address, type Hex } from 'viem';
import { createClient, CELO, NATIVE_TOKEN, signerFromPrivateKey, type Session, type SessionPermissions } from '@altananetwork/sdk';
import { payRunAbi } from './abi.ts';
import { CELO_CHAIN_ID } from './payslip.ts';
import { USDT } from './textile.ts';

/** PayRun.run((address,(address,uint256)[],uint256,uint256,uint64,bytes32),bytes,uint256,bytes). */
export const RUN_SELECTOR: Hex = '0xac219ae6';

/** The session's whole call permission: PayRun.run. grantSession adds a daily cap on the fee token itself. */
export function payRunPermissions(payRun: Address): SessionPermissions {
  return { calls: [{ to: payRun, signature: RUN_SELECTOR }] };
}

/**
 * The owner's own two calls that fund a float: approve PayRun for exactly `amount`, then deposit it. Sent from the
 * owner's key (the wallet is an EOA with an EIP-7702 delegation, so it can send its own transactions).
 */
export function fundFloatCalls(payRun: Address, amount: bigint) {
  return [
    { to: USDT, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [payRun, amount] }), value: 0n },
    { to: payRun, data: encodeFunctionData({ abi: payRunAbi, functionName: 'deposit', args: [amount] }), value: 0n },
  ] as const;
}

/** The owner's call that takes USD₮ back out of their float. */
export function withdrawFloatCall(payRun: Address, amount: bigint) {
  return { to: payRun, data: encodeFunctionData({ abi: payRunAbi, functionName: 'withdraw', args: [amount] }), value: 0n };
}

export function altana() {
  // The owner's wallet registers no ERC-8004 identity of its own; Albashi's agent holds the one identity (D-004).
  return createClient({ chains: [CELO], agentIdentity: false });
}

/** Owner action: grant the agent's session key a session that may call only PayRun.run, until `expiry`. */
export async function ownerGrantPayRunSession(args: {
  ownerKey: Hex;
  sessionKey: Hex;
  payRun: Address;
  expiry: number;
}): Promise<Session> {
  const signer = signerFromPrivateKey(args.ownerKey);
  return altana().grantSession({
    wallet: { address: signer.address },
    signer,
    sessionSigner: signerFromPrivateKey(args.sessionKey),
    permissions: payRunPermissions(args.payRun),
    expiry: args.expiry,
    feeToken: NATIVE_TOKEN,
    chainId: CELO_CHAIN_ID,
  });
}
