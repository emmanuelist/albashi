// Persistent caching for reads that can never change: a mined transaction's transfers and block time, and a
// fully passing check of one. Next's data cache stores JSON, so bigints and dates go in as strings and come back
// out as bigint and Date. A failed read throws inside the cached function, so it is never cached; the next
// request asks Celo again. The block number is read on every request; the rate is held briefly (see cachedRate).
import { unstable_cache } from 'next/cache';
import type { Hash } from 'viem';
import { checkSelfRelay, readMovement, readRate, readTxTime, type CheckRun, type Movement, type Rate } from './proof';

type MovementJson = { hash: Hash; at: string; transfers: { token: 'USDT' | 'CNGN'; from: string; to: string; units: string }[] };

const movementJson = unstable_cache(
  async (hash: Hash): Promise<MovementJson> => {
    const m = await readMovement(hash);
    if (!m) throw new Error(`Celo did not return ${hash}`);
    return { hash: m.hash, at: m.at.toISOString(), transfers: m.transfers.map((t) => ({ ...t, units: t.units.toString() })) };
  },
  ['movement-v1'],
  { revalidate: false },
);

export async function cachedMovement(hash: Hash): Promise<Movement | null> {
  try {
    const j = await movementJson(hash);
    return { hash: j.hash, at: new Date(j.at), transfers: j.transfers.map((t) => ({ ...t, units: BigInt(t.units) })) };
  } catch {
    return null;
  }
}

const txTimeIso = unstable_cache(
  async (hash: Hash): Promise<string> => {
    const at = await readTxTime(hash);
    if (!at) throw new Error(`Celo did not return ${hash}`);
    return at.toISOString();
  },
  ['tx-time-v1'],
  { revalidate: false },
);

export async function cachedTxTime(hash: Hash): Promise<Date | null> {
  try {
    return new Date(await txTimeIso(hash));
  } catch {
    return null;
  }
}

type CheckRunJson = { checks: CheckRun['checks']; at: string };

class NotAllPassing extends Error {
  constructor(readonly run: CheckRun) {
    super('not every check passed');
  }
}

// Only a run where every check passed is kept; any FAIL is shown fresh and re-checked on the next request.
const passingRun = unstable_cache(
  async (): Promise<CheckRunJson> => {
    const run = await checkSelfRelay();
    if (!run) throw new Error('Celo did not answer');
    if (!run.checks.every((c) => c.ok)) throw new NotAllPassing(run);
    return { checks: run.checks, at: run.at.toISOString() };
  },
  ['self-relay-checks-v1'],
  { revalidate: false },
);

export async function cachedSelfRelayChecks(): Promise<CheckRun | null> {
  try {
    const j = await passingRun();
    return { checks: j.checks, at: new Date(j.at) };
  } catch (e) {
    return e instanceof NotAllPassing ? e.run : null;
  }
}

// Textile's preview takes anywhere from under a second to several seconds, and it is the first thing on the page.
// A quote is kept for up to 30 s and refreshed in the background. The page always prints the time the quote was
// actually read ("read HH:MM WAT"), so a cached quote is never shown as fresher than it is. A failed read throws,
// so it is never cached.
const rateJson = unstable_cache(
  async (): Promise<{ buyUnits: string; sellUnits: string; readAt: string }> => {
    const r = await readRate();
    if (!r) throw new Error('Textile did not quote');
    return { buyUnits: r.buyUnits.toString(), sellUnits: r.sellUnits.toString(), readAt: r.readAt.toISOString() };
  },
  ['textile-rate-v1'],
  { revalidate: 30 },
);

export async function cachedRate(): Promise<Rate | null> {
  try {
    const j = await rateJson();
    return { buyUnits: BigInt(j.buyUnits), sellUnits: BigInt(j.sellUnits), readAt: new Date(j.readAt) };
  } catch {
    return null;
  }
}
