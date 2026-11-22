// The owner's side of a pay run: one USD₮ approval to PayRun, and a session whose only permitted call is
// PayRun.run (D-009). Both are owner actions signed with the owner's own key and sent through Altana's relay, so they
// carry no attribution tag (D-006). The agent never holds a permission to call USD₮, cNGN or Textile directly: Altana
// pins a target and a selector but never the arguments, so any such permission could pay anyone.
import { encodeFunctionData, erc20Abi, type Address, type Hex } from 'viem';
import { createClient, CELO, NATIVE_TOKEN, signerFromPrivateKey, type Session, type SessionPermissions } from '@altananetwork/sdk';
import { CELO_CHAIN_ID } from './payslip.ts';
import { USDT } from './textile.ts';

/** PayRun.run((address,(address,uint256)[],uint256,uint256,uint64,bytes32),bytes,uint256,bytes). */
export const RUN_SELECTOR: Hex = '0xac219ae6';

/** The session's whole permission set: PayRun.run, plus a daily USD₮ cap as a second line behind the payslip. */
export function payRunPermissions(payRun: Address, usdtDailyCap: bigint): SessionPermissions {
  return {
    calls: [{ to: payRun, signature: RUN_SELECTOR }],
    spend: [{ token: USDT, limit: usdtDailyCap, period: 'day' }],
  };
}

/** The approval the owner gives once, from their own key: PayRun may pull at most `amount` USD₮. */
export function approvePayRunCall(payRun: Address, amount: bigint) {
  return { to: USDT, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [payRun, amount] }), value: 0n };
}

export function altana() {
  // The owner's wallet registers no ERC-8004 identity of its own; Albashi's agent holds the one identity (D-004).
  return createClient({ chains: [CELO], agentIdentity: false });
}

/** Owner action: approve PayRun for USD₮ (Altana relay; untagged by design, D-006). */
export async function ownerApprovePayRun(args: { ownerKey: Hex; payRun: Address; amount: bigint }) {
  const signer = signerFromPrivateKey(args.ownerKey);
  return altana().execute({
    wallet: { address: signer.address },
    signer,
    calls: [approvePayRunCall(args.payRun, args.amount)],
    feeToken: NATIVE_TOKEN,
    chainId: CELO_CHAIN_ID,
  });
}

/** Owner action: grant the agent's session key a session that may call only PayRun.run, until `expiry`. */
export async function ownerGrantPayRunSession(args: {
  ownerKey: Hex;
  sessionKey: Hex;
  payRun: Address;
  usdtDailyCap: bigint;
  expiry: number;
}): Promise<Session> {
  const signer = signerFromPrivateKey(args.ownerKey);
  return altana().grantSession({
    wallet: { address: signer.address },
    signer,
    sessionSigner: signerFromPrivateKey(args.sessionKey),
    permissions: payRunPermissions(args.payRun, args.usdtDailyCap),
    expiry: args.expiry,
    feeToken: NATIVE_TOKEN,
    chainId: CELO_CHAIN_ID,
  });
}
