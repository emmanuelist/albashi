// Server-side reads for the proof page. Every value comes from Celo mainnet or Textile's API at request
// time; nothing here is invented. When a source is down the caller gets `null` and says so on screen.
import { createPublicClient, erc20Abi, http, parseEventLogs, type Hash } from 'viem';
import { celo } from 'viem/chains';

const RPC = process.env.CELO_RPC_URL ?? 'https://forno.celo.org';
const TEXTILE = 'https://api.textilecredit.com/v2';
export const USDT = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as const;
export const CNGN = '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f' as const;
const DECIMALS = 6n; // USD₮ and cNGN, verified with decimals() on forno (docs/CONTEXT.md)
const REPO = 'https://github.com/emmanuelist/albashi/blob/main';

const client = createPublicClient({ chain: celo, transport: http(RPC, { timeout: 8_000 }) });

/** Token base units to a display string with two decimals. Display only: never fed back into a transaction. */
export function formatUnits2(units: bigint): string {
  const cents = (units * 100n + 10n ** DECIMALS / 2n) / 10n ** DECIMALS;
  const whole = (cents / 100n).toLocaleString('en-US');
  return `${whole}.${(cents % 100n).toString().padStart(2, '0')}`;
}

/** Wall-clock time in Lagos (WAT, UTC+1) as HH:MM. */
export function wat(date: Date): string {
  return date.toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: false });
}
export function watDay(date: Date): string {
  return date.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short' });
}

export const short = (hex: string) => `${hex.slice(0, 6)}…${hex.slice(-4)}`;
export const celoscan = (hash: string) => `https://celoscan.io/tx/${hash}`;

export type Rate = { buyUnits: bigint; sellUnits: bigint; readAt: Date };

/** Textile's free RFQ preview for 1 USD₮ → cNGN (POST /rfq/preview, no auth). */
export async function readRate(): Promise<Rate | null> {
  try {
    const sellUnits = 10n ** DECIMALS;
    const res = await fetch(`${TEXTILE}/rfq/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chainId: celo.id, sellToken: USDT, buyToken: CNGN, sellAmount: sellUnits.toString() }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { buyAmount?: string } };
    if (!body.data?.buyAmount) return null;
    return { buyUnits: BigInt(body.data.buyAmount), sellUnits, readAt: new Date() };
  } catch {
    return null;
  }
}

export async function readBlockNumber(): Promise<bigint | null> {
  try {
    return await client.getBlockNumber();
  } catch {
    return null;
  }
}

export type Movement = {
  hash: Hash;
  at: Date;
  /** ERC-20 transfers in the transaction for the two tokens we use, in base units. */
  transfers: { token: 'USDT' | 'CNGN'; from: string; to: string; units: bigint }[];
};

/** Reads a mined transaction's receipt and block from Celo and decodes its USD₮ / cNGN transfers. */
export async function readMovement(hash: Hash): Promise<Movement | null> {
  try {
    const receipt = await client.getTransactionReceipt({ hash });
    if (receipt.status !== 'success') return null;
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    const logs = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs });
    const transfers = logs.flatMap((log) => {
      const addr = log.address.toLowerCase();
      const token = addr === USDT.toLowerCase() ? 'USDT' : addr === CNGN.toLowerCase() ? 'CNGN' : null;
      return token ? [{ token, from: log.args.from, to: log.args.to, units: log.args.value } as const] : [];
    });
    return { hash, at: new Date(Number(block.timestamp) * 1000), transfers };
  } catch {
    return null;
  }
}

/** The mainnet transactions recorded in docs/EVIDENCE.md that the page shows. */
export const EVIDENCE = {
  /** E-002: the agent swapped 1 USD₮ → cNGN on Textile through Altana's relay. */
  swapViaRelay: '0x2226464a8499c60bbf80bb96e8f8432b938f976f84ca2148fbed4b8cb059f95d',
  /** E-003: the agent paid the cNGN to a second wallet. */
  payout: '0x37c107dbe9efcfa20ffe56d179045c2ac29dae9cd16d16f094bcf3c4355513db',
  /** E-005: the agent's own wallet submitted the swap and tagged it celo_3f5cac8c49f6. */
  swapSelfRelay: '0x6272cb58f29012a94b6ed19a486c24f3e4887ca4ad2418c296d4500e4d0130c5',
} as const satisfies Record<string, Hash>;

/**
 * E-007: refused by the Altana session before anything reached Celo, so there is no transaction.
 * The captured run log is the proof. The run lasted 20:06:58–20:07:58 UTC; the refusal came after the swap.
 */
export const REFUSAL = {
  attemptedUnits: 1_500_000n,
  capUnits: 2_000_000n,
  code: 'spend_limit_exceeded',
  at: new Date('2026-11-21T20:07:00Z'),
  proof: `${REPO}/docs/evidence/selfrelay-run-2026-11-21T20-07Z.json`,
} as const;
