import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeAbiParameters, decodeFunctionData, erc20Abi, toFunctionSelector, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { toDataSuffix } from '@celo/attribution-tags';
import * as Key from 'porto/viem/Key';
import { payRunAbi } from '../src/abi.ts';
import { buildRunCall, RunRefused } from '../src/payrun.ts';
import {
  ATTRIBUTION_CODE, EXECUTE_ABI, INTENT, intentFrom, laneForKeyHash, laneNonce, secp256k1KeyHash, stripEip7708AssetDiffs,
  taggedExecuteCalldata,
} from '../src/relay.ts';
import { fundFloatCalls, payRunPermissions, RUN_SELECTOR } from '../src/session.ts';
import { REACTOR, USDT, type FirmQuote } from '../src/textile.ts';
import { VECTOR, VECTOR_PAYRUN } from './vector.ts';

// The SDK's own implementations, imported by file path (its package exports allow no deep imports) so these
// tests fail the moment our port drifts from @altananetwork/sdk 1.1.0.
const sdk = '../node_modules/@altananetwork/sdk/dist/internal/';
const sdkLane = (await import(sdk + 'appNonceLane.js')) as { laneForKeyHash(h: Hex): bigint; laneNonce(l: bigint, c: bigint): bigint };
const sdkKey = (await import(sdk + 'erc1271.js')) as { computeAccountSecp256k1KeyHash(a: Hex): Hex };
const sdkStrip = (await import(sdk + 'eip7708.js')) as { stripEip7708AssetDiffs<T>(r: T): T };

const session = privateKeyToAccount('0x00000000000000000000000000000000000000000000000000000000005e5510');

test('key hash and nonce lane match the SDK', () => {
  const ours = secp256k1KeyHash(session.address);
  assert.equal(ours, sdkKey.computeAccountSecp256k1KeyHash(session.address));
  assert.equal(laneForKeyHash(ours), sdkLane.laneForKeyHash(ours));
  assert.equal(laneNonce(laneForKeyHash(ours), 7n), sdkLane.laneNonce(sdkLane.laneForKeyHash(ours), 7n));
  // porto's own Key.hash agrees too: the relay and the account index the session by this value.
  const key = Key.fromSecp256k1({ privateKey: '0x00000000000000000000000000000000000000000000000000000000005e5510', role: 'session' });
  assert.equal(key.hash, ours);
});

test('the relay sanitizer matches the SDK on EIP-7708 asset diffs', () => {
  const response = {
    capabilities: {
      assetDiffs: {
        '0xa4ec': [
          ['0xowner', [{ address: '0xfffffffffffffffffffffffffffffffffffffffe', value: '0x1' }, { address: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e', value: '0x2' }]],
          ['0xother', [{ address: '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE', value: '0x3' }]],
        ],
      },
    },
    untouched: [1, 2, { assetDiffs: null }],
  };
  assert.deepEqual(stripEip7708AssetDiffs(response), sdkStrip.stripEip7708AssetDiffs(response));
  const kept = stripEip7708AssetDiffs(response).capabilities.assetDiffs['0xa4ec'];
  assert.equal(kept.length, 1, 'an entry left with no diffs is dropped');
  assert.equal((kept[0]![1] as unknown[]).length, 1, 'only the system-address diff is removed');
});

test("the session's only permission is PayRun.run, by its real selector", () => {
  const runItem = payRunAbi.find((i) => i.type === 'function' && i.name === 'run');
  assert.ok(runItem);
  assert.equal(RUN_SELECTOR, toFunctionSelector(runItem as never));
  const perms = payRunPermissions(VECTOR_PAYRUN);
  assert.deepEqual(perms.calls, [{ to: VECTOR_PAYRUN, signature: RUN_SELECTOR }]);
  // No token spend cap of ours: a run moves no USD₮ out of the owner's wallet (D-010).
  assert.equal(perms.spend, undefined);
});

test('the float is funded by an exact approval and a deposit, and only those', () => {
  const [approve, deposit] = fundFloatCalls(VECTOR_PAYRUN, 1_500_000n);
  const a = decodeFunctionData({ abi: erc20Abi, data: approve.data });
  assert.equal(approve.to, USDT);
  assert.equal(a.functionName, 'approve');
  assert.equal((a.args[0] as string).toLowerCase(), VECTOR_PAYRUN.toLowerCase());
  assert.equal(a.args[1], 1_500_000n, 'an exact approval, never unlimited');
  const d = decodeFunctionData({ abi: payRunAbi, data: deposit.data });
  assert.equal(deposit.to, VECTOR_PAYRUN);
  assert.deepEqual([d.functionName, ...d.args], ['deposit', 1_500_000n]);
});

const relayContext = {
  quote: {
    quotes: [
      {
        intent: {
          eoa: '0x1111111111111111111111111111111111111111',
          executionData: '0xdeadbeef',
          nonce: '0x' + (laneNonce(laneForKeyHash(secp256k1KeyHash(session.address)), 3n)).toString(16),
          paymentToken: '0x0000000000000000000000000000000000000000',
          paymentMaxAmount: '0x2c68af0bb140000',
          combinedGas: '0x7a120',
          expiry: '0x6a1b2c3d',
          paymentAmount: '0x2386f26fc10000',
          paymentRecipient: '0x2222222222222222222222222222222222222222',
          supportedAccountImplementation: '0x3333333333333333333333333333333333333333',
        },
      },
    ],
  },
};

test('the Intent is rebuilt from the relay context and tagged at the very end', () => {
  const signature: Hex = '0xabcdef';
  const intent = intentFrom(relayContext, signature);
  assert.equal(intent.signature, signature);
  assert.equal(intent.paymentAmount, 0x2386f26fc10000n);
  assert.equal(intent.payer, '0x0000000000000000000000000000000000000000');

  const data = taggedExecuteCalldata(intent);
  const suffix = toDataSuffix(ATTRIBUTION_CODE);
  assert.ok(data.endsWith(suffix.slice(2)), 'the attribution tag is the tail of the outer calldata');
  const call = decodeFunctionData({ abi: EXECUTE_ABI, data: data.slice(0, data.length - (suffix.length - 2)) as Hex });
  const [decoded] = decodeAbiParameters([INTENT], call.args[0]);
  assert.equal(decoded.executionData, '0xdeadbeef');
  assert.equal(decoded.nonce, intent.nonce);
  assert.equal(decoded.signature, signature);
});

test('a context without an intent is refused before anything is signed or sent', () => {
  assert.throws(() => intentFrom({ quote: { quotes: [] } }, '0x'), /no intent/);
});

const quote: FirmQuote = {
  takerPays: 1_000_000n,
  buyAmount: 1_440_569_022n,
  reactor: REACTOR,
  swap: { to: REACTOR, data: ('0x0d7a16c3' + '00'.repeat(32)) as Hex },
  expiresAt: undefined,
};

test('buildRunCall encodes exactly the signed payslip, the quote and its swap', () => {
  const call = buildRunCall({ payRun: VECTOR_PAYRUN, payslip: VECTOR, ownerSignature: '0x1234', quote, nowSeconds: 1_700_000_000n });
  assert.equal(call.to, VECTOR_PAYRUN);
  const { functionName, args } = decodeFunctionData({ abi: payRunAbi, data: call.data });
  assert.equal(functionName, 'run');
  const [p, sig, usdtIn, swapData] = args as readonly [typeof VECTOR, Hex, bigint, Hex];
  assert.equal(p.lines.length, 2);
  assert.equal(p.lines[1]!.amount, 800_000_000n);
  assert.equal(sig, '0x1234');
  assert.equal(usdtIn, quote.takerPays);
  assert.equal(swapData, quote.swap.data);
});

test('buildRunCall refuses a quote below the floor or too small, in sentences', () => {
  const now = 1_700_000_000n;
  const poor = { ...quote, buyAmount: 1_429_000_000n };
  assert.throws(() => buildRunCall({ payRun: VECTOR_PAYRUN, payslip: VECTOR, ownerSignature: '0x', quote: poor, nowSeconds: now }), (e: unknown) =>
    e instanceof RunRefused && e.problems.includes('The quote is below the minimum rate the owner signed.'));
  const big = { ...VECTOR, lines: [{ to: VECTOR.lines[0]!.to, amount: 1_500_000_000n }] };
  assert.throws(() => buildRunCall({ payRun: VECTOR_PAYRUN, payslip: big, ownerSignature: '0x', quote, nowSeconds: now }), (e: unknown) =>
    e instanceof RunRefused && e.problems.includes('The quote buys less cNGN than the payslip pays out.'));
});
