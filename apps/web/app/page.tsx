// The proof page's first viewport: the approved lock-screen comp (.impeccable/mocks/comp-2.png) filled with
// real data. The rate is Textile's live preview; every alert is a Celo mainnet transaction recorded in
// docs/EVIDENCE.md, read from the chain at request time; the declined alert is a real refusal from the
// agent's Altana session, which stopped it before anything reached Celo, so it links the captured run log.
import type { ReactNode } from 'react';
import {
  EVIDENCE,
  REFUSAL,
  celoscan,
  formatUnits2,
  readBlockNumber,
  readMovement,
  readRate,
  short,
  wat,
  watDay,
  type Movement,
} from './lib/proof';

// Rendered on every request: the rate's "read" time must be the moment Textile was actually asked.
export const dynamic = 'force-dynamic';

type Alert = {
  id: 'alert-2' | 'alert-3' | 'alert-4';
  icon: 'credit' | 'fx';
  lines: [string, string];
  time: string;
  href: string;
  label: string;
};

function swapAlert(id: Alert['id'], m: Movement | null, hash: string, desc: string): Alert {
  if (!m) return unreadable(id, hash);
  const cngn = m.transfers.find((t) => t.token === 'CNGN');
  const owner = cngn?.to.toLowerCase();
  const sold = m.transfers.filter((t) => t.token === 'USDT' && t.from.toLowerCase() === owner).reduce((s, t) => s + t.units, 0n);
  if (!cngn || sold === 0n) return unreadable(id, hash);
  return {
    id,
    icon: 'fx',
    lines: [`FX ALERT! USD₮${formatUnits2(sold)} → cNGN${formatUnits2(cngn.units)}`, `DESC: ${desc} REF: ${short(hash)}`],
    time: `${watDay(m.at)} ${wat(m.at)}`,
    href: celoscan(hash),
    label: `Swap of USD₮${formatUnits2(sold)} for cNGN${formatUnits2(cngn.units)} on Celo, transaction ${hash}`,
  };
}

function payoutAlert(id: Alert['id'], m: Movement | null, hash: string): Alert {
  if (!m) return unreadable(id, hash);
  const cngn = m.transfers.find((t) => t.token === 'CNGN');
  if (!cngn) return unreadable(id, hash);
  return {
    id,
    icon: 'credit',
    lines: [`CREDIT ALERT! AMT: cNGN${formatUnits2(cngn.units)}`, `TO: ${short(cngn.to)} REF: ${short(hash)}`],
    time: `${watDay(m.at)} ${wat(m.at)}`,
    href: celoscan(hash),
    label: `Payout of cNGN${formatUnits2(cngn.units)} to ${cngn.to}, transaction ${hash}`,
  };
}

function unreadable(id: Alert['id'], hash: string): Alert {
  return {
    id,
    icon: 'fx',
    lines: ['CELO DID NOT ANSWER IN TIME.', `REF: ${short(hash)} (OPEN ON CELOSCAN)`],
    time: '',
    href: celoscan(hash),
    label: `Celo did not answer; open transaction ${hash} on Celoscan`,
  };
}

function DownArrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="glyph">
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 6.8v9.6M8 12.6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Swap() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="glyph">
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7.5 10h8.5l-2.5-2.5M16.5 14H8l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cross() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="glyph">
      <path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type CardProps = {
  id: string;
  icon: ReactNode;
  iconClass: string;
  body: ReactNode;
  time: string;
  href?: string;
  label?: string;
  declined?: boolean;
};

function Card({ id, icon, iconClass, body, time, href, label, declined }: CardProps) {
  const inner = (
    <>
      <span className={`card-icon ${iconClass}`} aria-hidden="true">{icon}</span>
      <span className="card-text">
        <span className="card-head">
          <span className="sender">ALBASHI</span>
          <span className="time">{time}</span>
        </span>
        <span className={`body${declined ? ' declined' : ''}`}>{body}</span>
      </span>
    </>
  );
  return (
    <li className={`box r-${id} card${declined ? ' card-declined' : ''}`}>
      {href ? (
        <a className="card-in" href={href} target="_blank" rel="noreferrer" aria-label={label}>
          {inner}
        </a>
      ) : (
        <div className="card-in">{inner}</div>
      )}
    </li>
  );
}

export default async function Home() {
  const [rate, block, swapRelay, payout, swapSelf] = await Promise.all([
    readRate(),
    readBlockNumber(),
    readMovement(EVIDENCE.swapViaRelay),
    readMovement(EVIDENCE.payout),
    readMovement(EVIDENCE.swapSelfRelay),
  ]);
  const now = new Date();

  // Newest at the bottom, as an SMS thread reads: the relay swap, the payout, the agent's own tagged swap,
  // then the refusal that came after it in the same run.
  const alerts: Alert[] = [
    swapAlert('alert-2', swapRelay, EVIDENCE.swapViaRelay, 'AGENT SWAP'),
    payoutAlert('alert-3', payout, EVIDENCE.payout),
    swapAlert('alert-4', swapSelf, EVIDENCE.swapSelfRelay, 'SENT + TAGGED BY AGENT'),
  ];

  return (
    <main className="lock">
      {/* eslint-disable-next-line @next/next/no-img-element -- the hero plate is placed at its measured box; responsive formats come in the responsive phase */}
      <img className="box r-wallpaper wallpaper" src="/plates/wallpaper.png" alt="" fetchPriority="high" />
      {/* Grades the regenerated plate's upper sky back to the comp's magenta-violet and darkens the band the rate line sits on. */}
      <div className="box r-wallpaper sky-grade" aria-hidden="true" />
      <div className="box r-wallpaper rate-scrim" aria-hidden="true" />

      <header className="box r-statusbar statusbar" />
      <p className="box r-brand brand">ALBASHI</p>
      <p className="box r-network network">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="globe">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <span className="net-long">Celo mainnet · </span>
        <span className="net-short">Celo · </span>
        {block === null ? 'not answering' : `block ${block.toLocaleString('en-US')}`}
      </p>
      <nav className="box r-nav nav" aria-label="Albashi">
        <a href="#how">How it works</a>
        <span aria-hidden="true">·</span>
        <a href="#proof">Proof on Celo</a>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/emmanuelist/albashi">Docs</a>
      </nav>

      <h1 className="box r-rate rate">
        {rate ? `₦${formatUnits2((rate.buyUnits * 10n ** 6n) / rate.sellUnits)}` : '₦ ––'}
      </h1>
      <p className="box r-rate-line rate-line">
        {rate
          ? `per USD₮ · Textile FX quote · read ${wat(rate.readAt)} WAT`
          : `Textile isn't quoting right now · tried ${wat(now)} WAT`}
      </p>

      <ol className="alerts" aria-label="Albashi's alerts, each a real Celo mainnet record">
        <Card
          id="alert-1"
          icon="A"
          iconClass="app-icon"
          time="now"
          body={
            <>
              ALBASHI PAYS YOUR FREELANCERS IN NAIRA,{' '}
              <br className="desk-break" />
              AND ITS AGENT CAN ONLY PAY THE PAYSLIP YOU SIGNED.
            </>
          }
        />
        {alerts.map((a) => (
          <Card
            key={a.id}
            id={a.id}
            icon={a.icon === 'credit' ? <DownArrow /> : <Swap />}
            iconClass="credit-icon"
            time={a.time}
            href={a.href}
            label={a.label}
            body={
              <>
                {a.lines[0]}
                <br />
                {a.lines[1]}
              </>
            }
          />
        ))}
        <Card
          id="alert-5"
          declined
          icon={<Cross />}
          iconClass="declined-icon"
          time={`${watDay(REFUSAL.at)} ${wat(REFUSAL.at)}`}
          href={REFUSAL.proof}
          label={`Declined: USD₮${formatUnits2(REFUSAL.attemptedUnits)} would have taken the agent past its USD₮${formatUnits2(REFUSAL.capUnits)} daily cap, with USD₮${formatUnits2(REFUSAL.spentUnits)} already spent. Refused by the session before reaching Celo; open the captured run log`}
          body={
            <>
              DEBIT DECLINED: <span className="struck">USD₮{formatUnits2(REFUSAL.attemptedUnits)} WOULD PASS THE DAILY CAP</span>
            </>
          }
        />
      </ol>

      <a className="box r-btn-run round-action" href="#run">
        <span className="disc" aria-hidden="true">
        <svg viewBox="0 0 48 48" aria-hidden="true" className="action-glyph">
          <path d="M14 8h14l8 8v14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M14 8v30h12M19 18h11M19 24h11M19 30h6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="34" cy="35" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path d="m30.8 35 2.2 2.2 4.2-4.4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        </span>
        <span className="action-label">Run payroll</span>
      </a>
      <a className="box r-btn-try round-action" href="#try">
        <span className="disc" aria-hidden="true">
        <svg viewBox="0 0 48 48" aria-hidden="true" className="action-glyph">
          <circle cx="22" cy="15" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path d="M9 38c0-7.2 5.8-12 13-12 2.4 0 4.6.5 6.5 1.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="35" cy="34" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path d="m32.5 31.5 5 5m0-5-5 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        </span>
        <span className="action-label">Try to pay someone not on the payslip</span>
      </a>
    </main>
  );
}
