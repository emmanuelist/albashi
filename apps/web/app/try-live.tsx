'use client';
// The proof page's "Try to pay someone not on the payslip", answered where the judge already is: it asks PayRun live
// (POST /api/try, an eth_call: nothing is signed or sent) and the lock screen's refusal alert updates in place
// (live-refusal.tsx). Without JavaScript the same control is a link to the desk's check (/desk#try).
import { useState } from 'react';
import { TRY_EVENT, type TryAnswer } from './live-refusal';

export default function TryLive({ className, children }: { className: string; children: React.ReactNode }) {
  const [asking, setAsking] = useState(false);
  async function ask(e: React.MouseEvent) {
    e.preventDefault();
    setAsking(true);
    let detail: TryAnswer;
    try {
      const r = await fetch('/api/try', { method: 'POST' });
      if (!r.ok) throw new Error();
      const j = await r.json();
      detail = { at: j.checkedAt, block: j.block, verdict: j.tampered.verdict, amount: j.tampered.added.amount, strangerSends: j.strangerSends?.verdict ?? null };
    } catch {
      detail = 'down';
    }
    window.dispatchEvent(new CustomEvent(TRY_EVENT, { detail }));
    setAsking(false);
  }
  return (
    <a className={className} href="/desk#try" onClick={ask} aria-busy={asking}>
      {children}
      <span className="sr-live" role="status">{asking ? 'Asking Celo…' : ''}</span>
    </a>
  );
}
