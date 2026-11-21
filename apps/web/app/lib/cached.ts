// Persistent caching for reads that can never change: a mined transaction's transfers and block time, and a
// fully passing check of one. Next's data cache stores JSON, so bigints and dates go in as strings and come back
// out as bigint and Date. A failed read throws inside the cached function, so it is never cached; the next
// request asks Celo again. The rate and the block number are not cached here: they are read on every request.
import { unstable_cache } from 'next/cache';
import type { Hash } from 'viem';
import { checkSelfRelay, readMovement, readTxTime, type CheckRun, type Movement } from './proof';

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
