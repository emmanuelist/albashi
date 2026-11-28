// The owner desk (/desk). The agency's runs, float and the agent's session are read from Celo on the server, so the
// last real run is in the HTML for anyone, with no wallet and no JavaScript; signing and running happen in DeskApp.
import type { Metadata } from 'next';
import { cachedRate } from '../lib/cached.ts';
import { DESK_OWNER, SESSION_KEY_HASH, readOwner, readRuns } from '../lib/desk.ts';
import { PAYRUN } from '../lib/proof.ts';
import DeskApp, { type DeskProps } from './desk-app.tsx';
import './desk.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Owner desk · Albashi',
  description: 'The agency’s pay runs on Celo: each line the owner signed, and PayRun’s record of paying it.',
};

export default async function Desk() {
  const [runs, owner, rate] = await Promise.all([readRuns(), readOwner(), cachedRate()]);
  const props: DeskProps = {
    owner: DESK_OWNER,
    sessionKeyHash: SESSION_KEY_HASH,
    payRun: PAYRUN,
    readAt: new Date().toISOString(),
    rate: rate ? { buyUnits: rate.buyUnits.toString(), readAt: rate.readAt.toISOString() } : null,
    runs: runs?.map((r) => ({
      hash: r.hash,
      at: r.at,
      lines: r.payslip ? r.payslip.lines.map((l) => ({ to: l.to, amount: l.amount.toString() })) : null,
      paid: r.paid.map((p) => ({ line: p.line, to: p.to, amount: p.amount.toString() })),
      usdtSpent: r.usdtSpent.toString(),
      cngnReceived: r.cngnReceived.toString(),
      cngnPaid: r.cngnPaid.toString(),
      minRate: r.payslip ? r.payslip.minRate.toString() : null,
    })) ?? null,
    ownerState: owner
      ? {
          float: owner.float.toString(),
          walletUsdt: owner.walletUsdt.toString(),
          session: owner.session
            ? {
                expiry: owner.session.expiry.toISOString(),
                live: owner.session.live,
                calls: owner.session.calls,
                orchestratorDefault: owner.session.orchestratorDefault,
                caps: owner.session.caps.map((c) => ({ token: c.token, limit: c.limit.toString(), spentToday: c.spentToday.toString() })),
              }
            : null,
        }
      : null,
  };
  return (
    <main className="desk">
      <DeskApp {...props} />
    </main>
  );
}
