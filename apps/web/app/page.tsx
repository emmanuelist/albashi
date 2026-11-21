// Hero reproduction of the approved comp (.impeccable/mocks/comp-2.png), words verbatim.
// The values below are the comp's illustrative content and must be replaced with real Celo data
// (docs/EVIDENCE.md) before this page is deployed or published: see the plates note in the build log.

type Credit = { id: string; amount: string; who: string };

const CREDITS: Credit[] = [
  { id: 'alert-2', amount: 'NGN150,000.00', who: 'AMAKA O.' },
  { id: 'alert-3', amount: 'NGN95,000.00', who: 'TUNDE B.' },
  { id: 'alert-4', amount: 'NGN120,000.00', who: 'ZAINAB Y.' },
];

function DownArrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="glyph">
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 6.8v9.6M8 12.6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
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

export default function Home() {
  return (
    <main className="lock">
      {/* eslint-disable-next-line @next/next/no-img-element -- the hero plate is placed at its measured box; responsive formats come in the responsive phase */}
      <img className="box r-wallpaper wallpaper" src="/plates/wallpaper.png" alt="" fetchPriority="high" />

      {/* Grades the regenerated plate's upper sky back to the comp's magenta-violet and darkens the band the rate line sits on. */}
      <div className="box r-wallpaper sky-grade" aria-hidden="true" />
      <header className="box r-statusbar statusbar" />
      <p className="box r-brand brand">ALBASHI</p>
      <p className="box r-network network">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="globe">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        Celo mainnet · block 83,390,906
      </p>
      <nav className="box r-nav nav" aria-label="Albashi">
        <a href="#how">How it works</a>
        <span aria-hidden="true">·</span>
        <a href="#proof">Proof on Celo</a>
        <span aria-hidden="true">·</span>
        <a href="#docs">Docs</a>
      </nav>

      <h1 className="box r-rate rate">₦1,440.57</h1>
      <p className="box r-rate-line rate-line">per USD₮ · Textile FX · read 20:07 · signed floor ₦1,430</p>

      <ol className="alerts" aria-label="Notifications">
        <li className="box r-alert-1 card" />
        <li className="box r-alert-2 card" />
        <li className="box r-alert-3 card" />
        <li className="box r-alert-4 card" />
        <li className="box r-alert-5 card card-declined" />
      </ol>

      <span className="box r-alert-1-icon app-icon" aria-hidden="true">A</span>
      <p className="box r-alert-1-sender sender">ALBASHI</p>
      <p className="box r-alert-1-body body">
        ALBASHI PAYS YOUR FREELANCERS IN NAIRA,
        <br />
        AND ITS AGENT CAN ONLY PAY THE PAYSLIP YOU SIGNED.
      </p>
      <p className="box r-alert-1-time time">now</p>

      {CREDITS.map((c) => (
        <div key={c.id} className="credit-set">
          <span className={`box r-${c.id}-icon credit-icon`} aria-hidden="true"><DownArrow /></span>
          <p className={`box r-${c.id}-sender sender`}>ALBASHI</p>
          <p className={`box r-${c.id}-body body`}>
            CREDIT ALERT! AMT: {c.amount}
            <br />
            DESC: NOV PAY / {c.who} TIME: 20:07 REF: 0x6272…30c5
          </p>
          <p className={`box r-${c.id}-time time`}>now</p>
        </div>
      ))}

      <span className="box r-alert-5-icon declined-icon" aria-hidden="true"><Cross /></span>
      <p className="box r-alert-5-sender sender struck">ALBASHI</p>
      <p className="box r-alert-5-body body declined struck">DEBIT DECLINED: 0x7A3..F3 IS NOT ON THE PAYSLIP</p>
      <p className="box r-alert-5-time time">now</p>

      <a className="box r-btn-run round-action" href="#run">
        <svg viewBox="0 0 48 48" aria-hidden="true" className="action-glyph">
          <path d="M14 8h14l8 8v14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M14 8v30h12M19 18h11M19 24h11M19 30h6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="34" cy="35" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path d="m30.8 35 2.2 2.2 4.2-4.4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Run payroll</span>
      </a>
      <a className="box r-btn-try round-action" href="#try">
        <svg viewBox="0 0 48 48" aria-hidden="true" className="action-glyph">
          <circle cx="22" cy="15" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path d="M9 38c0-7.2 5.8-12 13-12 2.4 0 4.6.5 6.5 1.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="35" cy="34" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path d="m32.5 31.5 5 5m0-5-5 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <span>Try to pay someone not on the payslip</span>
      </a>
    </main>
  );
}
