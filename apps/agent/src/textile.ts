// Textile FX RFQ v2 for a pay run. Facts from fx-docs.textilecredit.com (api/v2/rfq.html, authentication.html),
// read 2026-11-22: preview needs no auth; a firm request names a taker and carries a takerProof (EIP-712
// "Textile Taker Control" v1) on the first request for that taker, after which about 12 h of requests may omit it;
// smart-contract takers are verified through EIP-1271; a firm quote can be executed only by its taker; quotes last
// about 60 s; always broadcast transactions.swap. PayRun is the taker, and its isValidSignature accepts the agent's
// key, so the agent signs the proof.
import { type Address, type Hex, type LocalAccount, bytesToHex, getAddress, isAddressEqual } from 'viem';
import { CELO_CHAIN_ID } from './payslip.ts';

export const TEXTILE = 'https://api.textilecredit.com/v2';
export const USDT: Address = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e';
export const CNGN: Address = '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f';
export const REACTOR: Address = '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3';
/** The reactor's fill entry points, the only calls PayRun will make: execute and executeBatch. */
export const FILL_SELECTORS = ['0x3f62192e', '0x0d7a16c3'] as const;

export const takerControlTypes = {
  TakerControl: [
    { name: 'taker', type: 'address' },
    { name: 'chainId', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'issuedAt', type: 'uint256' },
  ],
} as const;

export type TakerProof = { nonce: Hex; issuedAt: number; signature: Hex };

/** Proof that the agent controls `taker` (PayRun accepts the agent's signature through EIP-1271). */
export async function signTakerProof(agent: LocalAccount, taker: Address, now: number = Date.now()): Promise<TakerProof> {
  const nonce = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const issuedAt = now; // Unix milliseconds; must be within 60 s of Textile's clock
  const signature = await agent.signTypedData({
    domain: { name: 'Textile Taker Control', version: '1', chainId: CELO_CHAIN_ID },
    types: takerControlTypes,
    primaryType: 'TakerControl',
    message: { taker, chainId: BigInt(CELO_CHAIN_ID), nonce, issuedAt: BigInt(issuedAt) },
  });
  return { nonce, issuedAt, signature };
}

export type FirmQuote = {
  /** USD₮ that leaves the taker (base units). PayRun pulls exactly this. */
  takerPays: bigint;
  /** cNGN the taker receives (base units), as quoted. PayRun re-measures it on-chain. */
  buyAmount: bigint;
  reactor: Address;
  swap: { to: Address; data: Hex };
  expiresAt: string | undefined;
};

type Fetch = typeof fetch;

/** The free, unauthenticated preview: cNGN for `sellUnits` USD₮. */
export async function preview(sellUnits: bigint, f: Fetch = fetch): Promise<{ buyUnits: bigint }> {
  const res = await f(`${TEXTILE}/rfq/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chainId: CELO_CHAIN_ID, sellToken: USDT, buyToken: CNGN, sellAmount: sellUnits.toString() }),
  });
  const body = (await res.json()) as { data?: { buyAmount?: string }; error?: unknown };
  if (!res.ok || !body.data?.buyAmount) throw new TextileError('preview', res.status, body);
  return { buyUnits: BigInt(body.data.buyAmount) };
}

/** A firm USD₮ → cNGN quote bound to `taker`, for buying at least `buyUnits` cNGN. */
export async function firmQuote(
  args: { taker: Address; buyUnits: bigint; takerProof?: TakerProof },
  f: Fetch = fetch,
): Promise<FirmQuote> {
  const res = await f(`${TEXTILE}/rfq/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chainId: CELO_CHAIN_ID,
      sellToken: USDT,
      buyToken: CNGN,
      buyAmount: args.buyUnits.toString(),
      taker: args.taker,
      ...(args.takerProof ? { takerProof: args.takerProof } : {}),
    }),
    signal: AbortSignal.timeout(90_000), // the venue may hold a firm request up to ~75 s
  });
  const body: unknown = await res.json();
  if (!res.ok) throw new TextileError('request', res.status, body);
  return parseFirmQuote(body);
}

type QuoteResponse = {
  data?: {
    status?: string;
    quote?: { reactor?: string; takerPays?: string; buyAmount?: string; expiresAt?: string };
    transactions?: { swap?: { to?: string; data?: string } };
  };
};

/** Reads a firm-quote response defensively: nothing reaches a transaction unless every field is present. */
export function parseFirmQuote(body: unknown): FirmQuote {
  // Shape seen on mainnet (spike, 2026-11-21): { data: { status: 'quoted', rfqId, quote: { reactor, takerPays,
  // buyAmount, expiresAt }, transactions: { swap: { to, data, value, chainId } } } }.
  const data = (body as QuoteResponse | null)?.data ?? {};
  if (data.status !== 'quoted') throw new Error(`Textile did not quote (status ${String(data.status)})`);
  const quote = data.quote ?? {};
  const swap = data.transactions?.swap;
  if (!quote.takerPays || !swap?.to || !swap.data) throw new Error('Textile returned a quote without takerPays or transactions.swap');
  return {
    takerPays: BigInt(quote.takerPays),
    buyAmount: quote.buyAmount !== undefined ? BigInt(quote.buyAmount) : 0n,
    reactor: getAddress(quote.reactor ?? swap.to),
    swap: { to: getAddress(swap.to), data: swap.data as Hex },
    expiresAt: quote.expiresAt,
  };
}

/**
 * The same checks PayRun makes before it swaps, applied to a quote before anyone signs or sends: the swap goes to
 * Textile's reactor through a fill entry point, and the USD₮ it takes fits the signed budget.
 */
export function checkQuoteForRun(q: FirmQuote, maxUsdtIn: bigint): string[] {
  const problems: string[] = [];
  if (!isAddressEqual(q.swap.to, REACTOR) || !isAddressEqual(q.reactor, REACTOR)) {
    problems.push(`The quote's swap is not on Textile's reactor (${q.swap.to}).`);
  }
  const selector = q.swap.data.slice(0, 10).toLowerCase();
  if (!(FILL_SELECTORS as readonly string[]).includes(selector)) problems.push(`The swap calls ${selector}, not a reactor fill.`);
  if (q.takerPays <= 0n) problems.push('The quote takes no USD₮.');
  if (q.takerPays > maxUsdtIn) problems.push('The quote needs more USD₮ than the payslip allows.');
  return problems;
}

export class TextileError extends Error {
  readonly step: 'preview' | 'request';
  readonly status: number;
  readonly body: unknown;
  constructor(step: 'preview' | 'request', status: number, body: unknown) {
    super(`Textile ${step} failed (${status}): ${JSON.stringify(body).slice(0, 300)}`);
    this.step = step;
    this.status = status;
    this.body = body;
  }
}
