// The freelancer's receipt: the link an agency sends each person it paid. Read from Celo on the server, so it opens
// in any phone browser or chat preview with no wallet and no JavaScript. Every value comes from the pay run's own
// transaction: PayRun's Paid event for this line, the run's rate, and the payslip inside it with the signature that
// authorised it. Names come from the payee book (lib/payees.ts); a wallet with no name says so.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAddress, isHash, type Address, type Hash } from 'viem';
import { readRun, type Run } from '../../../lib/desk.ts';
import { PAYEES, PAYERS } from '../../../lib/payees.ts';
import { CNGN, PAYRUN } from '../../../lib/proof.ts';
import { celoscanAddr, celoscanTx, money, rateOf, short, wat, watDay } from '../../../desk/format.ts';
import AlbashiMark from '../../../mark.tsx';
import './receipt.css';

export const dynamic = 'force-dynamic';

type Params = { hash: string; line: string };
type Found = { run: Run; line: number; to: Address; amount: bigint; signedAmount: bigint | null };

async function find(p: Params): Promise<Found | 'bad' | 'down' | 'missing'> {
  const line = Number(p.line) - 1; // people count lines from 1; PayRun counts from 0
  if (!isHash(p.hash) || !Number.isInteger(line) || line < 0 || line > 39) return 'bad';
  const run = await readRun(p.hash as Hash);
  if (!run) return 'down';
  const paid = run.paid.find((x) => x.line === line);
  if (!paid) return 'missing';
  const signed = run.payslip?.lines[line];
  return { run, line, to: getAddress(paid.to), amount: paid.amount, signedAmount: signed && signed.to.toLowerCase() === paid.to.toLowerCase() ? signed.amount : null };
}

const nameOf = (a: Address) => PAYEES[getAddress(a)] ?? null;
const payerOf = (a: Address) => PAYERS[getAddress(a)] ?? null;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const f = await find(await params);
  if (typeof f === 'string') return { title: 'Payment receipt · Albashi', robots: { index: false } };
  const who = nameOf(f.to) ?? short(f.to);
  const from = payerOf(f.run.payslip?.owner ?? f.to) ?? 'an agency on Albashi';
  const title = `₦${money(f.amount)} paid to ${who}`;
  return {
    title: `${title} · Albashi`,
    description: `From ${from}, ${watDay(new Date(f.run.at))} ${wat(new Date(f.run.at))} WAT. Confirmed on Celo; the amount is the one the agency signed.`,
    robots: { index: false },
    openGraph: { title, description: `From ${from}. Confirmed on Celo.` },
    twitter: { card: 'summary_large_image', title },
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="rc">
      <header className="rc-top">
        <Link href="/" className="rc-brand" aria-label="Albashi home"><AlbashiMark className="rc-mark" /><span>ALBASHI</span></Link>
      </header>
      {children}
    </main>
  );
}

export default async function Receipt({ params }: { params: Promise<Params> }) {
  const f = await find(await params);
  if (f === 'bad' || f === 'missing') {
    return (
      <Shell>
        <section className="rc-sheet rc-empty">
          <h1 className="rc-h1">No payment on this link</h1>
          <p>{f === 'bad' ? 'The link is incomplete or mistyped.' : 'That pay run has no payment on this line.'} Ask whoever sent it for the receipt link again.</p>
        </section>
      </Shell>
    );
  }
  if (f === 'down') {
    return (
      <Shell>
        <section className="rc-sheet rc-empty">
          <h1 className="rc-h1">Celo didn’t answer</h1>
          <p>The receipt is read from Celo each time it opens, and the network didn’t respond just now. Nothing here is a placeholder: reload in a moment.</p>
        </section>
      </Shell>
    );
  }

  const { run, to, amount, signedAmount } = f;
  const at = new Date(run.at);
  const owner = run.payslip?.owner ?? null;
  const who = nameOf(to);
  const from = owner ? payerOf(owner) : null;
  const signedByOwner = !!owner && !!run.signer && run.signer.toLowerCase() === owner.toLowerCase();
  const matches = signedAmount !== null && signedAmount === amount;
  const rate = rateOf(run.cngnReceived, run.usdtSpent);
  const minRate = run.payslip?.minRate ?? null;

  return (
    <Shell>
      <article className="rc-sheet" aria-labelledby="rc-title">
        <p className="rc-kicker">Payment receipt</p>
        <h1 id="rc-title" className="rc-amount" aria-label={`You were paid ₦${money(amount)}`}>₦{money(amount)}</h1>
        <p className="rc-stamp"><span>PAID</span> {watDay(at)} {wat(at)} WAT</p>

        <dl className="rc-facts">
          <div><dt>To</dt><dd><span className="rc-name">{who ?? 'Wallet with no name on file'}</span><span className="rc-mono">{short(to)}</span></dd></div>
          <div><dt>From</dt><dd><span className="rc-name">{from ?? 'The agency’s wallet'}</span>{owner && <span className="rc-mono">{short(owner)}</span>}</dd></div>
          <div><dt>Paid in</dt><dd>cNGN, a naira stablecoin (each one is meant to be worth ₦1)</dd></div>
          <div><dt>Exchange rate</dt><dd><span className="rc-mono">₦{money(rate)}</span> per $1{minRate !== null && <span className="rc-muted rc-line">Never below ₦{money(minRate)}, the lowest the agency accepted.</span>}</dd></div>
        </dl>

        <section className="rc-why" aria-labelledby="rc-why-title">
          <h2 id="rc-why-title" className="rc-h2">{signedByOwner && matches ? 'The agency signed this exact amount' : 'What Celo shows about this payment'}</h2>
          <ul className="rc-checks">
            <li className={signedByOwner ? 'ok' : 'no'}><span className="rc-v">{signedByOwner ? 'Yes' : 'No'}</span>The payslip was signed by the agency’s own wallet before anything was paid.</li>
            <li className={matches ? 'ok' : 'no'}><span className="rc-v">{matches ? 'Yes' : 'No'}</span>You received exactly the amount on that signed line{signedAmount !== null && !matches ? ` (signed: ₦${money(signedAmount)})` : ''}.</li>
            <li className="ok"><span className="rc-v">Yes</span>Confirmed on Celo, the network the payment was made on.</li>
          </ul>
          <p className="rc-note">Albashi’s agent pays only what the agency signed. It can’t change an amount or add anyone.</p>
        </section>

        <section className="rc-cash" aria-labelledby="rc-cash-title">
          <h2 id="rc-cash-title" className="rc-h2">See it in your wallet</h2>
          <ol className="rc-steps">
            <li>In MetaMask (or any wallet), switch to the <strong>Celo</strong> network.</li>
            <li>Import the cNGN token: <span className="rc-mono rc-wrap">{CNGN}</span></li>
            <li>Your balance shows in cNGN.</li>
          </ol>
          <h2 className="rc-h2">Getting it into your bank</h2>
          <p className="rc-pending"><span className="rc-tag">Being checked</span> We’re confirming, with our first freelancer, exactly how cNGN is changed into naira in a Nigerian bank account, what it costs and how long it takes. This section will say so once it’s been done for real.</p>
        </section>

        <footer className="rc-proof">
          <a className="rc-link" href={`${celoscanTx(run.hash)}#eventlog`} target="_blank" rel="noreferrer">View this payment on Celoscan</a>
          <a className="rc-link" href={celoscanAddr(PAYRUN)} target="_blank" rel="noreferrer">The payroll contract that paid it</a>
          <p className="rc-muted rc-small">Transaction <span className="rc-mono rc-wrap">{run.hash}</span></p>
        </footer>
      </article>
    </Shell>
  );
}
