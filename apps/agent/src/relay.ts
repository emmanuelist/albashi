// Self-relay without intercepting the SDK (D-003, D-006). Altana's relay prepares and quotes a session intent;
// the session key signs it here; the agent's own wallet submits it to the Orchestrator with Albashi's attribution
// tag at the very end of the outer calldata, so Celo's attribution indexer credits it.
//
// Everything below mirrors @altananetwork/sdk 1.1.0 (unchanged in 1.2.0, whose exported tagCalls is used) using only public packages (the SDK's package exports allow no
// deep imports):
//   - the relay transport strips EIP-7708 system-address asset diffs before porto validates a response
//     (sdk dist/internal/relay.js sanitizingHttp, dist/internal/eip7708.js);
//   - a session key signs with the same descriptor it was granted with (dist/execute.js submittingKey);
//   - each key acts on its own nonce lane (dist/internal/appNonceLane.js), so it never collides with the relay's own
//     work on lane 0;
//   - porto/viem/RelayActions prepareCalls and signCalls do the preparing and signing (as the SDK does), and the
//     relay's final step, sendPreparedCalls, is replaced by our own transaction.
// test/relay.test.ts checks the lane, key-hash and sanitizer helpers against the SDK's own files.
import {
  concat,
  createClient,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  http,
  keccak256,
  padHex,
  type Address,
  type Hex,
  type Account,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { RELAY_URL, attributionCodes, attributionTag, tagCalls, type Session } from '@altananetwork/sdk';
import * as Key from 'porto/viem/Key';
import { prepareCalls, signCalls } from 'porto/viem/RelayActions';
import { toDataSuffix } from '@celo/attribution-tags';

/** Altana's (Porto) Orchestrator on Celo; execute(bytes) accepts any caller (verified source, docs/CONTEXT.md). */
export const ORCHESTRATOR: Address = '0xaf140d0416a994aebb3fa6212b16ce6700f09751';
export const ATTRIBUTION_CODE = 'celo_3f5cac8c49f6';
/**
 * The tag SDK 1.2.0's own execute() puts on a session's calls when the client sets appCode: `altana,<code>` on the
 * end of the last call with data (sdk dist/attribution.js tagCalls). Altana asked builders to use it (CONTEXT,
 * 26 Nov). Self-relay keeps Celo's tag at the outer tail as well, where verifyTx reads it.
 */
export function innerTag(): Hex {
  // Built on first use, not at import: Next's server bundle evaluates the SDK after this module, and a call at module
  // scope hits it uninitialised ("Cannot access before initialization", web build, 28 Nov).
  return (innerTagMemo ??= attributionTag(attributionCodes(ATTRIBUTION_CODE)));
}
let innerTagMemo: Hex | undefined;
const ZERO: Address = '0x0000000000000000000000000000000000000000';

/** Albashi runs on Celo only; Celo clients carry Celo's own transaction formatters. */
export type CeloPublicClient = PublicClient<Transport, typeof celo>;
export type CeloWalletClient = WalletClient<Transport, typeof celo, Account>;

// ---------------------------------------------------------------- the relay transport

export const EIP7708_SYSTEM_ADDRESS = '0xfffffffffffffffffffffffffffffffffffffffe';

type Json = unknown;

function sanitizeChain(entries: Json): Json {
  if (!Array.isArray(entries)) return entries;
  const kept: unknown[] = [];
  let changed = false;
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2 || !Array.isArray(entry[1])) {
      kept.push(entry);
      continue;
    }
    const before = entry[1] as unknown[];
    const diffs = before.filter(
      (d) => !(typeof d === 'object' && d !== null && String((d as { address?: unknown }).address).toLowerCase() === EIP7708_SYSTEM_ADDRESS),
    );
    if (diffs.length === before.length) {
      kept.push(entry);
      continue;
    }
    changed = true;
    if (diffs.length === 0) continue;
    kept.push([entry[0], diffs, ...entry.slice(2)]);
  }
  return changed ? kept : entries;
}

function sanitizeAssetDiffs(assetDiffs: Json): Json {
  if (typeof assetDiffs !== 'object' || assetDiffs === null || Array.isArray(assetDiffs)) return assetDiffs;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [chainId, entries] of Object.entries(assetDiffs)) {
    const next = sanitizeChain(entries);
    if (next !== entries) changed = true;
    out[chainId] = next;
  }
  return changed ? out : assetDiffs;
}

/** Removes EIP-7708 system-address entries from any `assetDiffs` in a relay response (porto rejects them). */
export function stripEip7708AssetDiffs<T>(result: T): T {
  if (Array.isArray(result)) {
    let changedHere = false;
    const mapped = result.map((v) => {
      const next = stripEip7708AssetDiffs(v);
      if (next !== v) changedHere = true;
      return next;
    });
    return (changedHere ? mapped : result) as T;
  }
  if (typeof result !== 'object' || result === null) return result;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result)) {
    const next = key === 'assetDiffs' ? sanitizeAssetDiffs(value) : stripEip7708AssetDiffs(value);
    if (next !== value) changed = true;
    out[key] = next;
  }
  return (changed ? out : result) as T;
}

function sanitizingHttp(url: string): Transport {
  const inner = http(url, { timeout: 60_000 });
  return ((params: Parameters<Transport>[0]) => {
    const transport = inner(params);
    return { ...transport, request: async (args: unknown) => stripEip7708AssetDiffs(await transport.request(args as never)) };
  }) as Transport;
}

export function relayClient(url: string = RELAY_URL) {
  return createClient({ chain: celo, transport: sanitizingHttp(url) });
}

// ---------------------------------------------------------------- keys and nonce lanes

/** The account's key hash for a secp256k1 key, as IthacaAccount stores it (sdk erc1271.js). */
export function secp256k1KeyHash(address: Address): Hex {
  const publicKeyHash = keccak256(padHex(address, { size: 32 }));
  return keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'bytes32' }], [2n, publicKeyHash]));
}

const APP_LANE_PREFIX = 0xa17an;

/** The nonce lane a key acts on (sdk appNonceLane.js laneForKeyHash). */
export function laneForKeyHash(keyHash: Hex): bigint {
  const hashed = BigInt(keccak256(keyHash));
  return (APP_LANE_PREFIX << 176n) | (hashed & ((1n << 176n) - 1n));
}

export function laneNonce(lane: bigint, counter: bigint): bigint {
  return (lane << 64n) | counter;
}

const GET_NONCE_ABI = [
  { name: 'getNonce', type: 'function', stateMutability: 'view', inputs: [{ name: 'seqKey', type: 'uint192' }], outputs: [{ type: 'uint256' }] },
] as const;

/** The next nonce on the session key's lane, read from the wallet. */
export async function nextLaneNonce(pub: CeloPublicClient, wallet: Address, sessionKeyAddress: Address): Promise<bigint> {
  const lane = laneForKeyHash(secp256k1KeyHash(sessionKeyAddress));
  const next = await pub.readContract({ address: wallet, abi: GET_NONCE_ABI, functionName: 'getNonce', args: [lane], blockTag: 'pending' });
  return laneNonce(lane, next & ((1n << 64n) - 1n));
}

/** The porto Key a session signs with: the same descriptor it was granted with (sdk execute.js). */
export function sessionKey(session: Session, sessionPrivateKey: Hex) {
  return Key.fromSecp256k1({
    privateKey: sessionPrivateKey,
    role: 'session',
    expiry: session.expiry,
    permissions: session.permissions as never,
  });
}

// ---------------------------------------------------------------- the Intent

/** The Intent struct exactly as the deployed Orchestrator declares it (verified source on Celo Blockscout). */
export const INTENT = {
  type: 'tuple',
  components: [
    { name: 'eoa', type: 'address' },
    { name: 'executionData', type: 'bytes' },
    { name: 'nonce', type: 'uint256' },
    { name: 'payer', type: 'address' },
    { name: 'paymentToken', type: 'address' },
    { name: 'paymentMaxAmount', type: 'uint256' },
    { name: 'combinedGas', type: 'uint256' },
    { name: 'encodedPreCalls', type: 'bytes[]' },
    { name: 'encodedFundTransfers', type: 'bytes[]' },
    { name: 'settler', type: 'address' },
    { name: 'expiry', type: 'uint256' },
    { name: 'isMultichain', type: 'bool' },
    { name: 'funder', type: 'address' },
    { name: 'funderSignature', type: 'bytes' },
    { name: 'settlerContext', type: 'bytes' },
    { name: 'paymentAmount', type: 'uint256' },
    { name: 'paymentRecipient', type: 'address' },
    { name: 'signature', type: 'bytes' },
    { name: 'paymentSignature', type: 'bytes' },
    { name: 'supportedAccountImplementation', type: 'address' },
  ],
} as const;

export const EXECUTE_ABI = [
  { type: 'function', name: 'execute', stateMutability: 'payable', inputs: [{ name: 'encodedIntent', type: 'bytes' }], outputs: [{ name: 'err', type: 'bytes4' }] },
] as const;

const big = (v: unknown): bigint => (v === undefined || v === null ? 0n : BigInt(v as string));

type RelayIntent = Record<string, unknown>;

/** The Intent the relay would have submitted: its signed quote's intent, carrying the session's wrapped signature. */
export function intentFrom(context: unknown, signature: Hex) {
  const quote = (context as { quote?: { quotes?: { intent?: RelayIntent }[] } } | undefined)?.quote?.quotes?.[0];
  const i = quote?.intent;
  if (!i) throw new Error('the relay returned no intent in its prepared context');
  return {
    eoa: i.eoa as Address,
    executionData: i.executionData as Hex,
    nonce: big(i.nonce),
    payer: (i.payer as Address | undefined) ?? ZERO,
    paymentToken: i.paymentToken as Address,
    paymentMaxAmount: big(i.paymentMaxAmount ?? i.totalPaymentMaxAmount),
    combinedGas: big(i.combinedGas),
    encodedPreCalls: (i.encodedPreCalls as Hex[] | undefined) ?? [],
    encodedFundTransfers: (i.encodedFundTransfers as Hex[] | undefined) ?? [],
    settler: (i.settler as Address | undefined) ?? ZERO,
    expiry: big(i.expiry),
    isMultichain: Boolean(i.isMultichain),
    funder: (i.funder as Address | undefined) ?? ZERO,
    funderSignature: (i.funderSignature as Hex | undefined) ?? '0x',
    settlerContext: (i.settlerContext as Hex | undefined) ?? '0x',
    paymentAmount: big(i.paymentAmount ?? i.totalPaymentAmount),
    paymentRecipient: (i.paymentRecipient as Address | undefined) ?? ZERO,
    signature,
    paymentSignature: (i.paymentSignature as Hex | undefined) ?? '0x',
    supportedAccountImplementation: (i.supportedAccountImplementation as Address | undefined) ?? ZERO,
  };
}

/** Orchestrator.execute(abi.encode(intent)), with the attribution tag appended to the very end. */
export function taggedExecuteCalldata(intent: ReturnType<typeof intentFrom>, code: string = ATTRIBUTION_CODE): Hex {
  const encoded = encodeAbiParameters([INTENT], [intent]);
  return concat([encodeFunctionData({ abi: EXECUTE_ABI, functionName: 'execute', args: [encoded] }), toDataSuffix(code)]);
}

export type Call = { to: Address; data: Hex; value?: bigint };

export type SelfRelayResult = {
  nonce: bigint;
  paymentToken: Address;
  paymentAmount: bigint;
  /** Orchestrator.execute's return value in simulation: 0x00000000 means it would succeed. */
  simulatedErr: Hex;
  hash?: Hex;
  status?: 'success' | 'reverted';
};

export class SimulationRefused extends Error {
  readonly simulatedErr: Hex;
  constructor(simulatedErr: Hex) {
    super(`Orchestrator simulation returned ${simulatedErr}; nothing was sent`);
    this.simulatedErr = simulatedErr;
  }
}

/**
 * Prepares `calls` for the owner's wallet under the session, signs them with the session key, simulates, and (when
 * `send` is set) submits from the agent wallet with the tag at the tail. Orchestrator.execute returns an error code
 * instead of reverting, so a non-zero simulation result stops everything before a transaction exists.
 */
export async function selfRelay(args: {
  pub: CeloPublicClient;
  agent: CeloWalletClient;
  relay?: ReturnType<typeof relayClient>;
  session: Session;
  sessionPrivateKey: Hex;
  calls: Call[];
  feeToken: Address;
  send: boolean;
}): Promise<SelfRelayResult> {
  const relay = args.relay ?? relayClient();
  const key = sessionKey(args.session, args.sessionPrivateKey);
  const keyAddress = privateKeyToAccount(args.sessionPrivateKey).address;
  const nonce = await nextLaneNonce(args.pub, args.session.walletAddress, keyAddress);

  const prepared = await prepareCalls(relay, {
    account: args.session.walletAddress,
    calls: tagCalls(args.calls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? 0n })), innerTag(), { session: true }).map((c) => ({ to: c.to, data: c.data, value: c.value ?? 0n })),
    key,
    feeToken: args.feeToken,
    nonce,
  });
  const raw = await signCalls(prepared, { key });
  const signature = Key.wrapSignature(raw, { keyType: key.type, publicKey: key.publicKey, prehash: key.prehash ?? false });
  const intent = intentFrom(prepared.context, signature);
  const data = taggedExecuteCalldata(intent);

  const agentAddress = args.agent.account.address;
  const sim = await args.pub.call({ account: agentAddress, to: ORCHESTRATOR, data });
  const simulatedErr = decodeFunctionResult({ abi: EXECUTE_ABI, functionName: 'execute', data: sim.data ?? '0x' });
  const result: SelfRelayResult = { nonce: intent.nonce, paymentToken: intent.paymentToken, paymentAmount: intent.paymentAmount, simulatedErr };
  if (simulatedErr !== '0x00000000') throw new SimulationRefused(simulatedErr);
  if (!args.send) return result;

  const gas = await args.pub.estimateGas({ account: agentAddress, to: ORCHESTRATOR, data });
  const hash = await args.agent.sendTransaction({ account: args.agent.account, chain: celo, to: ORCHESTRATOR, data, gas: (gas * 13n) / 10n });
  const receipt = await args.pub.waitForTransactionReceipt({ hash });
  return { ...result, hash, status: receipt.status };
}
