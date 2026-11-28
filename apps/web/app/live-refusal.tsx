'use client';
// The lock screen's refusal alert. On load it shows the recorded refusal (E-011, the captured run log); when the
// visitor presses "Try to pay someone not on the payslip", the same card is answered live from Celo in place
// (TryLive dispatches the answer), so the result arrives as one more alert in the stack, not a pop-up.
import { useEffect, useRef, useState } from 'react';

export type TryAnswer = { at: string; block: string; verdict: string; amount: string; strangerSends: string | null } | 'down';
export const TRY_EVENT = 'albashi:try';

const wat = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: false });
const cngn = (units: string) => `cNGN${(Number(BigInt(units) / 10_000n) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function LiveRefusal({ time, href, amount, error, icon }: { time: string; href: string; amount: string; error: string; icon: React.ReactNode }) {
  const [live, setLive] = useState<TryAnswer | null>(null);
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const on = (e: Event) => { setLive((e as CustomEvent<TryAnswer>).detail); };
    window.addEventListener(TRY_EVENT, on);
    return () => window.removeEventListener(TRY_EVENT, on);
  }, []);
  useEffect(() => {
    if (!live) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    ref.current?.focus({ preventScroll: true });
  }, [live]);

  const answered = live && live !== 'down';
  const refused = answered && live.verdict !== 'accepted';
  const label = !live
    ? `Refused: ${amount} to a payee the owner never signed for. The pay-run contract refused it (${error}) and Altana's relay would not sign it, so nothing was sent; open the captured run log`
    : live === 'down'
      ? 'Celo did not answer, so nothing was checked. Try again in a moment.'
      : `Asked live at ${wat(live.at)}: the payroll contract refused ${cngn(live.amount)} to someone not on the payslip (${live.verdict}, block ${Number(live.block).toLocaleString('en-US')}). No money moved.`;
  return (
    <li ref={ref} tabIndex={-1} className="box r-alert-5 card card-declined" aria-live="polite">
      <a className="card-in" href={answered ? '/desk#try' : href} target={answered ? undefined : '_blank'} rel="noreferrer" aria-label={label}>
        <span className="card-icon declined-icon" aria-hidden="true">{icon}</span>
        <span className="card-text">
          <span className="card-head">
            <span className="sender">ALBASHI</span>
            <span className="time">{answered ? `live · ${wat(live.at)}` : live === 'down' ? 'now' : time}</span>
          </span>
          <span className="body declined">
            {live === 'down'
              ? 'CELO DID NOT ANSWER. NOTHING WAS CHECKED.'
              : <>{refused || !live ? 'DEBIT REFUSED: ' : 'NOT REFUSED: '}<span className="struck">{answered ? cngn(live.amount) : amount}</span> · PAYEE NOT ON PAYSLIP{answered && <><br />{live.verdict.toUpperCase()}, BLOCK {Number(live.block).toLocaleString('en-US')}. NO MONEY MOVED.</>}</>}
          </span>
        </span>
      </a>
    </li>
  );
}
