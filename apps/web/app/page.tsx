// The proof page's first viewport: the approved lock-screen comp (.impeccable/mocks/comp-2.png) filled with
// real data. The rate is Textile's live preview; every alert is a Celo mainnet transaction recorded in
// docs/EVIDENCE.md, read from the chain at request time: the first pay run (E-010), a Textile swap and the two
// signed lines it paid. The declined alert is that payslip with an unsigned payee added (E-011): refused before
// anything was signed or sent, so it links the captured run log.
import type { ReactNode } from 'react';
import {
  EVIDENCE,
  PAYRUN,
  PAYSLIP_REFUSAL,
  celoscan,
  formatUnits2,
  readBlockNumber,
  short,
  summariseLines,
  summariseSwap,
  wat,
  watDay,
  type Movement,
} from './lib/proof';
import { Suspense } from 'react';
import { cachedMovement, cachedRate, cachedTxTime } from './lib/cached';
import Sections from './sections';
import AlbashiMark from './mark';
import TryLive from './try-live';
import LiveRefusal from './live-refusal';
import { PAYEES } from './lib/payees';
import { getAddress } from 'viem';

// Rendered on every request. The rate may be up to 30 s old, and its "read" time is always the moment Textile
// was actually asked (lib/cached.ts).
export const dynamic = 'force-dynamic';

const PHONE = '(max-width: 1279px), (max-aspect-ratio: 5/6)'; // matches the stacked layout in globals.css
const WIDE_W = [1280, 1920, 2560, 3200, 4096];
const PORTRAIT_W = [640, 960, 1280, 1742];
const set = (name: string, widths: number[], ext: string) => widths.map((w) => `/plates/${name}-${w}.${ext} ${w}w`).join(', ');

type Alert = {
  id: 'alert-2' | 'alert-3' | 'alert-4';
  icon: 'credit' | 'fx' | 'stop';
  lines: [string, string];
  time: string;
  href: string;
  label: string;
};

function swapAlert(id: Alert['id'], m: Movement | null, hash: string, desc: string): Alert {
  const swap = m && summariseSwap(m.transfers);
  if (!m || !swap) return unreadable(id, hash);
  const sold = formatUnits2(swap.soldUnits);
  const bought = formatUnits2(swap.boughtUnits);
  return {
    id,
    icon: 'fx',
    lines: [`FX ALERT! USD₮${sold} → cNGN${bought}`, `DESC: ${desc} REF: ${short(hash)}`],
    time: `${watDay(m.at)} ${wat(m.at)}`,
    href: celoscan(hash),
    label: `Swap of USD₮${sold} for cNGN${bought} on Celo, transaction ${hash}`,
  };
}

/** One signed payslip line, as the pay run paid it (n counts from 1). */
function lineAlert(id: Alert['id'], m: Movement | null, hash: string, n: number): Alert {
  const lines = m ? summariseLines(m.transfers, PAYRUN) : [];
  const line = lines[n - 1];
  if (!m || !line) return unreadable(id, hash);
  const amount = formatUnits2(line.units);
  // A person in the payee book is named, as a bank alert names who was paid (first name and surname only).
  const who = PAYEES[getAddress(line.to)]?.replace(/\s*\(.*\)$/, '') ?? null;
  return {
    id,
    icon: 'credit',
    lines: who
      ? [`CREDIT ALERT! cNGN${amount} TO ${who.toUpperCase()}`, `PAID EXACTLY AS SIGNED REF: ${short(hash)}`]
      : [`CREDIT ALERT! LINE ${n}: cNGN${amount}`, `TO: ${short(line.to)} REF: ${short(hash)}`],
    time: `${watDay(m.at)} ${wat(m.at)}`,
    href: who ? `/receipt/${hash}/${n}` : celoscan(hash),
    label: `Payslip line ${n} of ${lines.length}: cNGN${amount} paid to ${who ?? line.to}, transaction ${hash}${who ? '; open their receipt' : ''}`,
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

function Stop() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="glyph">
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="8.6" y="8.6" width="6.8" height="6.8" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
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

function Card({ id, icon, iconClass, body, time, href, label, declined, heading }: CardProps & { heading?: boolean }) {
  const Body = heading ? 'h1' : 'span';
  const inner = (
    <>
      <span className={`card-icon ${iconClass}`} aria-hidden="true">{icon}</span>
      <span className="card-text">
        <span className="card-head">
          <span className="sender">ALBASHI</span>
          <span className="time">{time}</span>
        </span>
        <Body className={`body${declined ? ' declined' : ''}`}>{body}</Body>
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
  const [rate, block, run, stoppedAt] = await Promise.all([cachedRate(), readBlockNumber(), cachedMovement(EVIDENCE.firstFreelancer), cachedTxTime(EVIDENCE.deskRevoke)]);
  const now = new Date();

  // Newest first, as a lock screen stacks them: the owner stopping the agent from the desk (E-019), the real
  // freelancer's payment and its exchange (E-018, one transaction), then a refusal the visitor can ask for live.
  const alerts: Alert[] = [
    {
      id: 'alert-2',
      icon: 'stop',
      lines: ['AGENT STOPPED: OWNER REVOKED IT, 1 TX', `ITS NEXT CALL REFUSED. REF: ${short(EVIDENCE.deskRevoke)}`],
      time: stoppedAt ? `${watDay(stoppedAt)} ${wat(stoppedAt)}` : '',
      href: celoscan(EVIDENCE.deskRevoke),
      label: `The owner stopped the agent from the desk in one transaction (${EVIDENCE.deskRevoke}); the agent's next call was refused`,
    },
    lineAlert('alert-3', run, EVIDENCE.firstFreelancer, 1),
    swapAlert('alert-4', run, EVIDENCE.firstFreelancer, 'PAYROLL RUN, TAGGED'),
  ];

  return (
    <main>
      <div className="lock">
      {/* The plate as AVIF/WebP at several widths; phones get a portrait crop centred on the bridge, shown
          height-bound (about 75vh wide), hence its sizes. The media
          query matches the phone layout's in globals.css. Each file carries its AI provenance in EXIF. */}
      <picture>
        <source media={PHONE} type="image/avif" srcSet={set('wallpaper-portrait', PORTRAIT_W, 'avif')} sizes="max(100vw, 75vh)" />
        <source media={PHONE} type="image/webp" srcSet={set('wallpaper-portrait', PORTRAIT_W, 'webp')} sizes="max(100vw, 75vh)" />
        <source type="image/avif" srcSet={set('wallpaper', WIDE_W, 'avif')} sizes="100vw" />
        <source type="image/webp" srcSet={set('wallpaper', WIDE_W, 'webp')} sizes="100vw" />
        <img className="box r-wallpaper wallpaper" src="/plates/wallpaper-1920.webp" alt="" fetchPriority="high" decoding="async" />
      </picture>
      {/* Grades the regenerated plate's upper sky back to the comp's magenta-violet and darkens the band the rate line sits on. */}
      <div className="box r-wallpaper sky-grade" aria-hidden="true" />
      <div className="box r-wallpaper rate-scrim" aria-hidden="true" />

      <header className="box r-statusbar statusbar" />
      <p className="box r-brand brand">
        <AlbashiMark className="brand-mark" />
        ALBASHI
      </p>
      <p className="box r-network network">
        {/* Celo's symbol, path verbatim from celo-org/docs favicon.svg (the official mark), drawn in the text colour. */}
        <svg viewBox="0 0 384 383" role="img" aria-label="Celo" className="celo-mark">
          <path
            fill="currentColor"
            d="M383.5,0H0.5v383h383V249.3h-63.6C298,298.1,248.7,332,192.3,332c-77.8,0-140.8-63.6-140.8-140.8C51.4,114,114.5,51,192.3,51C249.8,51,299.1,86,321,135.9h62.5V0z"
          />
        </svg>
        <span className="net-long">Celo mainnet · </span>
        <span className="net-short">mainnet · </span>
        {block === null ? 'not answering' : `block ${block.toLocaleString('en-US')}`}
      </p>
      <nav className="box r-nav nav" aria-label="Albashi">
        <a href="#how">How it works</a>
        <span aria-hidden="true">·</span>
        <a href="#proof">Proof on Celo</a>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/emmanuelist/albashi">Docs</a>
      </nav>

      <p className="box r-rate rate">
        {rate ? `₦${formatUnits2((rate.buyUnits * 10n ** 6n) / rate.sellUnits)}` : '₦ ––'}
      </p>
      <p className="box r-rate-line rate-line">
        {rate
          ? `per USD₮ · Textile FX quote · read ${wat(rate.readAt)} WAT`
          : `Textile isn't quoting right now · tried ${wat(now)} WAT`}
      </p>

      <ol className="alerts" aria-label="Albashi's alerts, each a real Celo mainnet record">
        <Card
          id="alert-1"
          icon={<AlbashiMark className="app-mark" />}
          iconClass="app-icon"
          time="now"
          heading
          body={
            <>
              {/* The thesis, verbatim (docs/EVIDENCE.md C-1: E-010, E-011; its limits are under #limits). */}
              ALBASHI PAYS YOUR FREELANCERS IN NAIRA.{' '}
              <br className="desk-break" />
              ITS AGENT CAN ONLY PAY THE PAYSLIP YOU SIGNED.
            </>
          }
        />
        {alerts.map((a) => (
          <Card
            key={a.id}
            id={a.id}
            icon={a.icon === 'credit' ? <DownArrow /> : a.icon === 'stop' ? <Stop /> : <Swap />}
            iconClass={a.icon === 'stop' ? 'declined-icon' : 'credit-icon'}
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
        <LiveRefusal
          time={`${watDay(PAYSLIP_REFUSAL.at)} ${wat(PAYSLIP_REFUSAL.at)}`}
          href={PAYSLIP_REFUSAL.proof}
          amount={`cNGN${formatUnits2(PAYSLIP_REFUSAL.attemptedUnits)}`}
          error={PAYSLIP_REFUSAL.error}
          icon={<Cross />}
        />
      </ol>

      <a className="box r-btn-run round-action" href="/desk">
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
      <TryLive className="box r-btn-try round-action">
        <span className="disc" aria-hidden="true">
        <svg viewBox="0 0 48 48" aria-hidden="true" className="action-glyph">
          <circle cx="22" cy="15" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path d="M9 38c0-7.2 5.8-12 13-12 2.4 0 4.6.5 6.5 1.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="35" cy="34" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path d="m32.5 31.5 5 5m0-5-5 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        </span>
        <span className="action-label">Try to pay someone not on the payslip</span>
      </TryLive>
      </div>
      {/* Streamed: the sections below the fold never hold up the first screen. */}
      <Suspense fallback={null}>
        <Sections />
      </Suspense>
    </main>
  );
}
