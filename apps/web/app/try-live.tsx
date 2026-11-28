'use client';
// The proof page's "Try to pay someone not on the payslip", answered where the judge already is: it asks PayRun live
// (POST /api/try, an eth_call: nothing is signed or sent) and the answer arrives as one more lock-screen alert.
// Without JavaScript the same control is a link to the desk's check (/desk#try).
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Answer = { at: string; block: string; verdict: string; amount: string; strangerSends: string | null };

const naira = (units: string) => (Number(BigInt(units) / 10_000n) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wat = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: false });

export default function TryLive({ className, children }: { className: string; children: React.ReactNode }) {
  const [state, setState] = useState<'idle' | 'asking' | 'down'>('idle');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (answer || state === 'down') cardRef.current?.focus(); }, [answer, state]);

  async function ask(e: React.MouseEvent) {
    e.preventDefault();
    setState('asking'); setAnswer(null);
    try {
      const r = await fetch('/api/try', { method: 'POST' });
      if (!r.ok) throw new Error();
      const j = await r.json();
      setAnswer({ at: j.checkedAt, block: j.block, verdict: j.tampered.verdict, amount: j.tampered.added.amount, strangerSends: j.strangerSends?.verdict ?? null });
      setState('idle');
    } catch {
      setState('down');
    }
  }

  const refused = answer && answer.verdict !== 'accepted';
  return (
    <>
      <a className={className} href="/desk#try" onClick={ask} aria-busy={state === 'asking'}>
        {children}
        {state === 'asking' && <span className="sr-live" role="status">Asking Celo…</span>}
      </a>
      {(answer || state === 'down') && (
        <div ref={cardRef} tabIndex={-1} className={`try-live${refused ? '' : ' try-live-plain'}`} role="status" aria-live="polite">
          <div className="try-live-head">
            <span className="try-live-from">ALBASHI</span>
            <span className="try-live-time">{answer ? `live · ${wat(answer.at)}` : 'now'}</span>
            <button type="button" className="try-live-close" aria-label="Dismiss" onClick={() => { setAnswer(null); setState('idle'); }}>×</button>
          </div>
          {answer ? (
            <>
              <p className="try-live-body">
                {refused ? 'DEBIT REFUSED: ' : 'NOT REFUSED: '}
                <span className={refused ? 'struck' : undefined}>cNGN{naira(answer.amount)} · PAYEE NOT ON PAYSLIP</span>
              </p>
              <p className="try-live-note">
                {refused
                  ? <>The payroll contract on Celo refused it ({answer.verdict}, block {Number(answer.block).toLocaleString('en-US')}): the owner never signed a payslip with this person on it. No money moved.{answer.strangerSends && answer.strangerSends !== 'accepted' ? <> Sent by the stranger themselves, it’s refused too ({answer.strangerSends}).</> : null}</>
                  : <>Celo didn’t refuse it ({answer.verdict}). That shouldn’t happen; please tell us.</>}
              </p>
            </>
          ) : (
            <p className="try-live-note">Celo didn’t answer, so nothing was checked. Try again in a moment.</p>
          )}
          <Link className="try-live-link" href="/desk#try">See it on the owner’s desk</Link>
        </div>
      )}
    </>
  );
}
