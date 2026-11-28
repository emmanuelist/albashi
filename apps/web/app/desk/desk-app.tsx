'use client';
// The owner desk. Server-rendered with the agency's last real run (so it reads with no JavaScript and no wallet);
// in the browser it adds the public refusal check, the owner's wallet, the payslip editor, signing, and the run.
// Every figure comes from Celo, Textile or the payslip the owner signed; a source that is down says so.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPublicClient, createWalletClient, custom, encodeFunctionData, erc20Abi, getAddress, http, isAddress, keccak256, toHex, type Address, type Hex } from 'viem';
import { celo } from 'viem/chains';
import { toDataSuffix } from '@celo/attribution-tags';
import { payslipDomain, payslipTypes, type Payslip } from '../agent/payslip.ts';
import { payRunAbi } from '../agent/abi.ts';
import { ATTRIBUTION_CODE } from '../agent/relay.ts';
import { celoscanAddr, celoscanTx, money, parseNaira, rateOf, short, wat, watDay } from './format.ts';
import { Check, Cross, Dot, Minus, Out, Pen, Plus, Wallet } from './icons.tsx';
import AlbashiMark from '../mark.tsx';
import { PAYEES, STRANGER } from '../lib/payees.ts';

const USDT: Address = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e';
const RUN_SELECTOR = '0xac219ae6';
const MAX_LINES = 40;
const COMPACT_AFTER = 6;

export type RunView = {
  hash: Hex;
  at: string;
  lines: { to: Address; amount: string }[] | null;
  paid: { line: number; to: Address; amount: string }[];
  usdtSpent: string;
  cngnReceived: string;
  cngnPaid: string;
  minRate: string | null;
};
export type OwnerView = {
  float: string;
  walletUsdt: string;
  session: null | { expiry: string; live: boolean; calls: { to: Address; selector: Hex }[]; orchestratorDefault: boolean; caps: { token: Address; limit: string; spentToday: string }[] };
};
export type DeskProps = {
  owner: Address;
  payRun: Address;
  runs: RunView[] | null;
  ownerState: OwnerView | null;
  rate: { buyUnits: string; readAt: string } | null;
  readAt: string;
};

type SlipState =
  | { kind: 'paid'; at: Date; hash: Hex; amount: bigint; line: number; fresh?: boolean }
  | { kind: 'declined'; sentence: string; note: string }
  | { kind: 'draft' }
  | { kind: 'signed' }
  | { kind: 'waiting' }
  | { kind: 'demo' }
  | { kind: 'unpaid' };

function Counterfoil({ s }: { s: SlipState }) {
  switch (s.kind) {
    case 'paid':
      return (
        <div className="foil foil-paid">
          <span className={`stamp${s.fresh ? ' stamp-land' : ''}`}><Check className="ic" />PAID {wat(s.at)}</span>
          <span className="foil-note"><span className="mono">₦{money(s.amount)}</span> received</span>
          <Link className="ref" href={`/receipt/${s.hash}/${s.line + 1}`}>Receipt to send</Link>
        </div>
      );
    case 'declined':
      return (
        <div className="foil foil-declined">
          <span className="stamp stamp-declined stamp-land"><Cross className="ic" />REFUSED</span>
          <span className="foil-note" title={s.sentence}>{s.sentence}</span>
          <span className="foil-meta">{s.note}</span>
        </div>
      );
    case 'signed':
      return <div className="foil foil-quiet"><span className="foil-word">Signed</span><span className="foil-meta">waiting for the agent</span></div>;
    case 'waiting':
      return <div className="foil foil-quiet foil-busy"><span className="foil-word">Paying</span><span className="foil-meta">stamped when the money lands</span></div>;
    case 'demo':
      return <div className="foil foil-quiet"><span className="foil-word">Signed</span><span className="foil-meta">test payslip, can never pay</span></div>;
    case 'unpaid':
      return <div className="foil foil-quiet"><span className="foil-word">Not paid</span><span className="foil-meta">no payment recorded for this line</span></div>;
    default:
      return <div className="foil foil-quiet"><span className="foil-word">Not signed yet</span></div>;
  }
}

// ---------------------------------------------------------------- the payee book

const BOOK_KEY = 'albashi.payees.v1';
type Book = Record<string, string>;
function readLocalBook(): Book {
  try { return JSON.parse(localStorage.getItem(BOOK_KEY) ?? '{}') as Book; } catch { return {}; }
}
function saveLocalBook(add: Book) {
  try { localStorage.setItem(BOOK_KEY, JSON.stringify({ ...readLocalBook(), ...add })); } catch { /* names stay for this visit only */ }
}
/** Names for addresses: the agency's payee book, plus names the owner typed in this browser (never on chain). */
const noSubscribe = () => () => {};
function useBook(): (a?: string) => string | null {
  // The server has no browser book; the client reads it after hydration, so both first renders agree.
  const raw = useSyncExternalStore(noSubscribe, () => { try { return localStorage.getItem(BOOK_KEY) ?? '{}'; } catch { return '{}'; } }, () => '{}');
  const local = useMemo<Book>(() => { try { return JSON.parse(raw) as Book; } catch { return {}; } }, [raw]);
  return (a) => {
    if (!a || !isAddress(a)) return null;
    const k = getAddress(a);
    if (k === STRANGER) return 'Someone not on the payslip';
    return PAYEES[k] ?? local[k] ?? null;
  };
}

function Slip({ n, to, name, amount, state, children, label }: { n: number | null; to?: string; name?: string | null; amount?: bigint | null; state: SlipState; children?: React.ReactNode; label?: string }) {
  const declined = state.kind === 'declined';
  return (
    <li className={`slip${declined ? ' slip-declined' : ''}`}>
      <div className="advice">
        <span className="advice-head">{label ?? (n === null ? 'Not on the signed payslip' : `Line ${n}`)}</span>
        {children ?? (
          <>
            <span className="payee-name">{name ?? 'Unnamed payee'}</span>
            <span className="payee" title={to}>
              <span className="sr">Wallet </span>
              <span className="payee-long">{to}</span>
              <span className="payee-short">{to ? short(to) : ''}</span>
            </span>
            <span className={`amt${declined ? ' struck' : ''}`}>₦{amount != null ? money(amount) : '–'}</span>
          </>
        )}
      </div>
      <Counterfoil s={state} />
    </li>
  );
}

// ---------------------------------------------------------------- the public refusal check

type TryResult = {
  checkedAt: string;
  block: string;
  signed: { payslip: { lines: { to: Address; amount: string }[] }; verdict: string };
  tampered: { added: { to: Address; amount: string }; verdict: string; sentence: string | null; revertData: string | null };
};

function TryBook({ result, nameOf }: { result: TryResult; nameOf: (a?: string) => string | null }) {
  const at = new Date(result.checkedAt);
  const declined = result.tampered.verdict !== 'accepted';
  return (
    <section className="book try-book" aria-live="polite" aria-label="The answer from Celo">
      <h3 className="book-title">{declined ? 'Refused: that person isn’t on the payslip the owner signed' : 'Not refused'}</h3>
      <p className="book-sub">
        We took the owner’s signed test payslip (the same two people, with a budget so small it can never pay), added one more
        person, and asked the payroll contract on Celo to pay it, as if the owner were sending it. Asked at {wat(at)} WAT. Nothing
        was signed, sent or spent.
      </p>
      <ol className="slips">
        {result.signed.payslip.lines.map((l, i) => <Slip key={l.to + i} n={i + 1} to={l.to} name={nameOf(l.to)} amount={BigInt(l.amount)} state={{ kind: 'demo' }} />)}
        <Slip
          n={null}
          to={result.tampered.added.to}
          name={nameOf(result.tampered.added.to)}
          amount={BigInt(result.tampered.added.amount)}
          state={declined
            ? { kind: 'declined', sentence: result.tampered.verdict === 'NotSigned' ? 'The owner never signed a payslip with this person on it.' : (result.tampered.sentence ?? 'The payroll contract refused it.'), note: `Celo’s answer: ${result.tampered.verdict}, block ${Number(result.block).toLocaleString('en-US')}` }
            : { kind: 'unpaid' }}
        />
      </ol>
      {declined && <p className="next-step">To pay someone new, the owner writes a new payslip with them on it and signs it. The agent can’t add anyone.</p>}
    </section>
  );
}

// ---------------------------------------------------------------- wallet

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown>; on?(e: string, f: (...a: unknown[]) => void): void; removeListener?(e: string, f: (...a: unknown[]) => void): void };
const eth = (): Eip1193 | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { ethereum?: Eip1193 }).ethereum);

function walletError(e: unknown): string {
  const m = (e as { shortMessage?: string; message?: string; code?: number });
  if (m.code === 4001 || /reject|denied/i.test(m.message ?? '')) return 'You declined it in your wallet. Nothing was signed or sent.';
  return (m.shortMessage ?? m.message ?? 'The wallet returned an error.').slice(0, 200);
}

// ---------------------------------------------------------------- how it pays, and how to check it

function Copy({ text, what }: { text: string; what: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-ghost btn-copy" aria-label={done ? `Copied ${what}` : `Copy ${what}`} onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1600); }, () => {}); }}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function HowItPays({ payRun, owner, last, session, feeLimit }: { payRun: Address; owner: Address; last: RunView | null; session: { expiry: string; orchestratorDefault: boolean } | null; feeLimit: bigint | null }) {
  return (
    <details className="how">
      <summary><span className="how-title">How Albashi pays, and how to check it</span><span className="how-hint">Five steps, each enforced on Celo</span></summary>
      <ol className="how-steps">
        <li><strong>The owner signs a payslip</strong> in their own wallet: who is paid, how much in naira, the lowest exchange rate they accept, and a one-hour deadline. Signing is free and sends nothing.</li>
        <li><strong>The agent holds one permission on the owner’s wallet</strong>{session ? <>, until <span className="mono">{watDay(new Date(session.expiry))}</span></> : null}: it may ask the payroll contract to pay a signed payslip, and nothing else.{feeLimit !== null && <> The wallet itself caps its network fees at <span className="mono">{money(feeLimit / 10n ** 12n)}</span> CELO a day.</>} The owner can end the permission with one transaction.</li>
        <li><strong>The payroll contract checks every line against the signature</strong>, plus the deadline, the budget and that the payslip runs only once. A person who isn’t on it, or a changed amount, is refused before any money moves.</li>
        <li><strong>Textile FX exchanges the dollars for naira</strong> at no less than the signed rate, or the whole run is refused.</li>
        <li><strong>Each person receives cNGN</strong>, a naira stablecoin, in their own wallet, with a receipt on Celo.</li>
      </ol>
      <p className="how-note">The agent sends its payment through Altana’s Orchestrator, which acts as the owner’s wallet: the payroll contract sees the payment coming from the owner. That’s why nobody else can call it directly; a stranger is refused before the signature is even read.</p>
      <dl className="check">
        {last && (
          <div>
            <dt>Last pay run</dt>
            <dd><span className="mono hash">{last.hash}</span><span className="check-acts"><Copy text={last.hash} what="the last pay run’s transaction ID" /><a href={celoscanTx(last.hash)} target="_blank" rel="noreferrer" aria-label="Open the last pay run on Celoscan">Celoscan<Out className="ic-s" /></a></span></dd>
          </div>
        )}
        <div>
          <dt>Payroll contract (PayRun)</dt>
          <dd><span className="mono hash">{payRun}</span><span className="check-acts"><Copy text={payRun} what="the payroll contract’s address" /><a href={celoscanAddr(payRun)} target="_blank" rel="noreferrer" aria-label="Open the payroll contract on Celoscan">Celoscan<Out className="ic-s" /></a><a href={`https://repo.sourcify.dev/42220/${payRun}`} target="_blank" rel="noreferrer" aria-label="Read the payroll contract’s verified source on Sourcify">Source<Out className="ic-s" /></a></span></dd>
        </div>
        <div>
          <dt>Owner’s wallet</dt>
          <dd><span className="mono hash">{owner}</span><span className="check-acts"><Copy text={owner} what="the owner’s wallet address" /><a href={celoscanAddr(owner)} target="_blank" rel="noreferrer" aria-label="Open the owner’s wallet on Celoscan">Celoscan<Out className="ic-s" /></a></span></dd>
        </div>
      </dl>
      <ul className="how-fine">
        <li>Amounts on Celo have 6 decimals in both currencies: <span className="mono">750000000</span> cNGN is ₦750.00; <span className="mono">1074829</span> USD₮ is $1.07.</li>
        <li>The source is verified on Sourcify as a partial match: the runtime code matches, and the contract is compiled without a metadata hash, which a full match needs.</li>
        <li>The agent’s permission is <span className="mono">PayRun.run</span> only{session?.orchestratorDefault ? ', plus the fee-payment permission Altana’s wallet gives every session' : ''}. Not audited.</li>
      </ul>
    </details>
  );
}

// ---------------------------------------------------------------- the desk

type DraftLine = { name: string; to: string; amount: string };
type Stage = { key: 'judged' | 'quoted' | 'sent' | 'done'; text: string; href?: string };

export default function DeskApp(props: DeskProps) {
  const router = useRouter();
  const last = props.runs?.[0] ?? null;
  const nameOf = useBook();
  const [tryState, setTryState] = useState<'idle' | 'asking' | 'error'>('idle');
  const [tryResult, setTryResult] = useState<TryResult | null>(null);

  const [account, setAccount] = useState<Address | null>(null);
  const [chainOk, setChainOk] = useState(true);
  const [walletMsg, setWalletMsg] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const isOwner = account !== null && account.toLowerCase() === props.owner.toLowerCase();

  const [drafting, setDrafting] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([{ name: '', to: '', amount: '' }]);
  const [floor, setFloor] = useState('');
  const [polledRate, setPolledRate] = useState<DeskProps['rate']>(null);
  const rate = (drafting && polledRate) || props.rate;
  const [phase, setPhase] = useState<'edit' | 'signing' | 'running' | 'done'>('edit');
  const [stages, setStages] = useState<Stage[]>([]);
  const [outcome, setOutcome] = useState<null | { status: string; sentence?: string; hash?: Hex; minedAt?: number; paid?: { line: number; to: Address; amount: string }[] }>(null);
  const [stamped, setStamped] = useState<number[]>([]);
  const [signedSlip, setSignedSlip] = useState<Payslip | null>(null);
  const [fund, setFund] = useState('');
  const [funding, setFunding] = useState<string | null>(null);

  // The live rate for the editor, refreshed while the owner writes.
  useEffect(() => {
    if (!drafting) return;
    let alive = true;
    const pull = () => fetch('/api/rate').then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && j) setPolledRate({ buyUnits: j.buyUnits, readAt: j.readAt }); }).catch(() => {});
    pull();
    const t = setInterval(pull, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [drafting]);

  // Default floor: 99% of the live rate, set once when the editor opens.
  const floorSet = useRef(false);
  useEffect(() => {
    if (drafting && rate && !floorSet.current) {
      floorSet.current = true;
      setFloor(money((BigInt(rate.buyUnits) * 99n) / 100n).replace(/,/g, ''));
    }
  }, [drafting, rate]);

  // Live like the chain: re-read the runs, rate, float and session every 30 s while the page is in view.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible' && phase !== 'running' && phase !== 'signing') router.refresh(); }, 30_000);
    return () => clearInterval(t);
  }, [router, phase]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const w = eth();
    if (!w?.on) return;
    const onAcc = (a: unknown) => setAccount(Array.isArray(a) && a[0] ? getAddress(a[0] as string) : null);
    const onChain = (c: unknown) => setChainOk(Number(c) === celo.id);
    w.on('accountsChanged', onAcc);
    w.on('chainChanged', onChain);
    return () => { w.removeListener?.('accountsChanged', onAcc); w.removeListener?.('chainChanged', onChain); };
  }, []);

  async function connect() {
    setWalletMsg(null);
    const w = eth();
    if (!w) { setWalletMsg('No wallet in this browser. Open the desk in a browser with MetaMask to sign as the owner.'); return; }
    setConnecting(true);
    try {
      const accs = (await w.request({ method: 'eth_requestAccounts' })) as string[];
      setAccount(accs[0] ? getAddress(accs[0]) : null);
      const chainId = Number(await w.request({ method: 'eth_chainId' }));
      if (chainId !== celo.id) {
        try {
          await w.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: toHex(celo.id) }] });
        } catch {
          await w.request({ method: 'wallet_addEthereumChain', params: [{ chainId: toHex(celo.id), chainName: 'Celo', nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 }, rpcUrls: ['https://forno.celo.org'], blockExplorerUrls: ['https://celoscan.io'] }] });
        }
      }
      setChainOk(Number(await w.request({ method: 'eth_chainId' })) === celo.id);
    } catch (e) {
      setWalletMsg(walletError(e));
    } finally {
      setConnecting(false);
    }
  }

  async function askPayRun() {
    setTryState('asking');
    try {
      const r = await fetch('/api/try', { method: 'POST' });
      if (!r.ok) throw new Error();
      setTryResult(await r.json());
      setTryState('idle');
    } catch {
      setTryState('error');
    }
  }

  // Arriving from the proof page's "Try to pay someone not on the payslip" (/desk#try): ask Celo straight away.
  const askedOnArrival = useRef(false);
  useEffect(() => {
    if (askedOnArrival.current || window.location.hash !== '#try') return;
    askedOnArrival.current = true;
    document.getElementById('try')?.scrollIntoView({ block: 'start' });
    void askPayRun();
  });

  // ---- the draft payslip, as base units
  const serverSession = props.ownerState?.session ?? null;
  const session = serverSession ? { ...serverSession, live: Date.parse(serverSession.expiry) > now } : null;
  const float = props.ownerState ? BigInt(props.ownerState.float) : null;
  const parsed = lines.map((l) => ({ to: isAddress(l.to.trim()) ? getAddress(l.to.trim()) : null, amount: parseNaira(l.amount) }));
  const owed = parsed.reduce((s, l) => s + (l.amount ?? 0n), 0n);
  const minRate = parseNaira(floor);
  const liveRate = rate ? BigInt(rate.buyUnits) : null;
  // The most USD₮ the run may take: what the payslip costs at the owner's own floor, rounded up.
  const maxUsdtIn = minRate ? (owed * 10n ** 6n + minRate - 1n) / minRate : 0n;
  const estUsdt = liveRate ? (owed * 10n ** 6n + liveRate - 1n) / liveRate : null;
  const problems: string[] = [];
  const fieldErr = parsed.map((l, i) => ({
    to: lines[i]!.to.trim() && !l.to ? 'That isn’t a Celo address (0x and 40 hex characters).' : null,
    amount: lines[i]!.amount.trim() && !l.amount ? 'Enter naira, up to two decimals.' : null,
  }));
  const complete = parsed.every((l) => l.to && l.amount);
  if (complete && liveRate && owed * 10n ** 6n < liveRate * 10n ** 6n) problems.push('Textile quotes from about US$1 per run: the payslip must total at least one dollar of naira.');
  if (minRate && liveRate && minRate > liveRate) problems.push('Your floor is above today’s rate, so no quote would clear it.');
  if (complete && float !== null && maxUsdtIn > float) problems.push(`At your floor this run could take up to USD₮${money(maxUsdtIn)}; the float holds USD₮${money(float)}. Add to the float first.`);
  const blockers: string[] = [];
  if (!isOwner) blockers.push('Connect the owner’s wallet to sign.');
  else if (!chainOk) blockers.push('Switch your wallet to Celo.');
  if (!session) blockers.push('The agent holds no session on this wallet.');
  else if (!session.live) blockers.push(`The agent’s session ended ${watDay(new Date(session.expiry))} ${wat(new Date(session.expiry))} WAT. The owner renews it before the next run.`);
  // The session's relay-fee cap on the owner's wallet (native CELO, per day). A run's fee was 0.667 CELO on
  // 2026-11-22 (docs/CONTEXT.md); refuse up front when less than that is left, rather than after signing.
  const feeCap = session?.caps.find((c) => c.token === '0x0000000000000000000000000000000000000000');
  const RUN_FEE = 700_000_000_000_000_000n;
  if (feeCap && BigInt(feeCap.limit) - BigInt(feeCap.spentToday) < RUN_FEE) {
    blockers.push(`The agent’s relay-fee allowance has ${money((BigInt(feeCap.limit) - BigInt(feeCap.spentToday)) / 10n ** 12n)} CELO left today; a run’s fee is about 0.67 CELO. It resets at 01:00 WAT, or the owner raises it.`);
  }
  const canSign = complete && fieldErr.every((f) => !f.to && !f.amount) && problems.length === 0 && blockers.length === 0 && !!minRate && phase === 'edit';

  async function signAndRun() {
    const w = eth();
    if (!w || !account || !minRate) return;
    setOutcome(null); setStages([]); setStamped([]); setPhase('signing');
    const payslip: Payslip = {
      owner: props.owner,
      lines: parsed.map((l) => ({ to: l.to!, amount: l.amount! })),
      maxUsdtIn,
      minRate,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      salt: keccak256(toHex(crypto.getRandomValues(new Uint8Array(32)))),
    };
    let signature: Hex;
    try {
      const wallet = createWalletClient({ account, chain: celo, transport: custom(w) });
      signature = await wallet.signTypedData({ account, domain: payslipDomain(props.payRun), types: payslipTypes, primaryType: 'Payslip', message: payslip });
    } catch (e) {
      setPhase('edit');
      setOutcome({ status: 'refused', sentence: walletError(e) });
      return;
    }
    setSignedSlip(payslip);
    saveLocalBook(Object.fromEntries(parsed.flatMap((l, i) => (l.to && lines[i]!.name.trim() ? [[l.to, lines[i]!.name.trim()]] : []))));
    setPhase('running');
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          payslip: { ...payslip, lines: payslip.lines.map((l) => ({ to: l.to, amount: l.amount.toString() })), maxUsdtIn: payslip.maxUsdtIn.toString(), minRate: payslip.minRate.toString(), deadline: payslip.deadline.toString() },
          signature,
        }),
      });
      if (!res.body || res.headers.get('content-type')?.includes('application/json')) {
        const j = await res.json();
        setOutcome({ status: j.status ?? 'error', sentence: j.sentence });
        setPhase('done');
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const ev = JSON.parse(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
          if (ev.stage === 'judged') setStages((s) => [...s, { key: 'judged', text: `Your signature checked: this payslip can be paid. Payroll balance $${money(BigInt(ev.float))}.` }]);
          if (ev.stage === 'quoted') setStages((s) => [...s, { key: 'quoted', text: `Exchange booked: $${money(BigInt(ev.takerPays))} buys ₦${money(BigInt(ev.buyAmount))} (Textile FX).` }]);
          if (ev.stage === 'sent') setStages((s) => [...s, { key: 'sent', text: 'The agent sent the payment.', href: celoscanTx(ev.hash) }]);
          if (ev.stage === 'done') {
            const o = ev.outcome;
            setOutcome({ status: o.status, sentence: o.sentence, hash: o.hash, minedAt: o.minedAt, paid: o.events?.paid });
            setPhase('done');
            if (o.status === 'paid') {
              // Each stamp is one confirmed Paid event, for the line that event names; they land in line order.
              const lines: number[] = (o.events?.paid ?? []).map((p: { line: string | number }) => Number(p.line)).sort((a: number, b: number) => a - b);
              lines.forEach((ln, k) => setTimeout(() => setStamped((x) => [...x, ln]), 240 * (k + 1)));
              setTimeout(() => router.refresh(), 240 * lines.length + 600);
            }
          }
        }
      }
    } catch (e) {
      setOutcome({ status: 'error', sentence: `The page lost the run’s progress (${(e as Error).message}). Check the agent’s wallet on Celoscan before trying again.` });
      setPhase('done');
    }
  }

  async function addToFloat() {
    const w = eth();
    const units = parseNaira(fund); // same 6-decimal parsing; USD₮ amount here
    if (!w || !account || !units) return;
    setFunding('Approve in your wallet…');
    try {
      const wallet = createWalletClient({ account, chain: celo, transport: custom(w), dataSuffix: toDataSuffix(ATTRIBUTION_CODE) });
      const pub = createPublicClient({ chain: celo, transport: http('https://forno.celo.org') });
      const a = await wallet.sendTransaction({ to: USDT, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [props.payRun, units] }) });
      setFunding('Waiting for the approval on Celo…');
      await pub.waitForTransactionReceipt({ hash: a });
      setFunding('Deposit in your wallet…');
      const d = await wallet.sendTransaction({ to: props.payRun, data: encodeFunctionData({ abi: payRunAbi, functionName: 'deposit', args: [units] }) });
      setFunding('Waiting for the deposit on Celo…');
      await pub.waitForTransactionReceipt({ hash: d });
      setFunding(null); setFund('');
      router.refresh();
    } catch (e) {
      setFunding(walletError(e));
    }
  }

  // ---- what the book shows
  const lastLines = useMemo(() => {
    if (!last) return [];
    const signed = last.lines ?? last.paid.map((p) => ({ to: p.to, amount: p.amount }));
    return signed.map((l, i) => {
      const p = last.paid.find((x) => x.line === i);
      return { to: l.to, amount: BigInt(l.amount), state: (p ? { kind: 'paid', at: new Date(last.at), hash: last.hash, amount: BigInt(p.amount), line: i } : { kind: 'unpaid' }) as SlipState };
    });
  }, [last]);
  const signedTotal = lastLines.reduce((s, l) => s + l.amount, 0n);
  const runRate = last ? rateOf(BigInt(last.cngnReceived), BigInt(last.usdtSpent)) : 0n;

  const draftStates: SlipState[] = parsed.map((_, i) => {
    if (phase === 'edit') return { kind: 'draft' };
    if (phase === 'signing') return { kind: 'draft' };
    if (phase === 'running') return { kind: 'waiting' };
    const ev = outcome?.paid?.find((p) => Number(p.line) === i);
    if (outcome?.status === 'paid' && outcome.hash && outcome.minedAt && ev && stamped.includes(i)) {
      return { kind: 'paid', at: new Date(outcome.minedAt * 1000), hash: outcome.hash, amount: BigInt(ev.amount), line: i, fresh: true };
    }
    if (outcome?.status === 'paid') return { kind: 'waiting' };
    return { kind: 'signed' };
  });

  return (
    <>
      <header className="dk-top">
        <Link href="/" className="dk-brand" aria-label="Albashi, the proof page">
          <AlbashiMark className="dk-mark" />
          <span className="dk-word">ALBASHI</span>
        </Link>
        <nav className="dk-tabs" aria-label="Albashi">
          <Link href="/desk" aria-current="page">Desk</Link>
          <Link href="/">Proof on Celo</Link>
        </nav>
        <div className="dk-wallet">
          {account ? (
            <span className={`chip${isOwner ? ' chip-owner' : ' chip-warn'}`}>
              <Wallet className="ic" /><span className="mono">{short(account)}</span> · {isOwner ? (chainOk ? 'owner' : 'switch to Celo') : 'not the owner'}
            </span>
          ) : (
            <button type="button" className="btn btn-quiet" onClick={connect} disabled={connecting}>
              <Wallet className="ic" />{connecting ? 'Confirm in your wallet…' : <><span className="wl-long">Read-only · connect the owner wallet</span><span className="wl-short">Connect</span></>}
            </button>
          )}
        </div>
      </header>
      {walletMsg && <p className="dk-banner" role="status">{walletMsg}</p>}
      {account && !isOwner && <p className="dk-banner" role="status">This wallet is {short(account)}. The desk’s owner is {short(props.owner)}: switch account in your wallet to write and sign. Everything else here stays readable.</p>}

      <div className="dk-grid">
        <div className="dk-main">
          {drafting && isOwner && (
            <section className="book draft-book" aria-label="New payslip">
              <div className="book-head">
                <h1 className="book-title">New payslip</h1>
                <button type="button" className="btn btn-ghost" onClick={() => { setDrafting(false); setPhase('edit'); setOutcome(null); }} disabled={phase === 'signing' || phase === 'running'}>Close</button>
              </div>
              <p className="book-sub">Write who gets paid and how much in naira. Once you sign, the agent can pay exactly these people these amounts, and nothing else. Names stay in this browser; only wallets and amounts are signed.</p>
              <ol className={`slips${lines.length > COMPACT_AFTER ? ' compact' : ''}`}>
                {lines.map((l, i) => (
                  <Slip key={i} n={i + 1} state={draftStates[i]!}>
                    <label className="fld">
                      <span className="sr">Line {i + 1} payee name</span>
                      <input className="in in-name" placeholder="Name, e.g. Ada (design)" value={l.name} autoComplete="off" disabled={phase !== 'edit'} maxLength={60}
                        onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
                    </label>
                    <label className="fld">
                      <span className="sr">Line {i + 1} payee address</span>
                      <input className="in in-mono" placeholder="Their Celo wallet, 0x…" value={l.to} spellCheck={false} autoComplete="off" disabled={phase !== 'edit'}
                        aria-invalid={!!fieldErr[i]!.to} aria-describedby={fieldErr[i]!.to ? `to-err-${i}` : undefined} onChange={(e) => { const v = e.target.value; setLines((x) => x.map((y, j) => (j === i ? { ...y, to: v, name: y.name || (nameOf(v.trim()) ?? '') } : y))); }} />
                      {fieldErr[i]!.to && <span className="fld-err" id={`to-err-${i}`}>{fieldErr[i]!.to}</span>}
                    </label>
                    <div className="amt-row">
                      <label className="fld fld-amt">
                        <span className="sr">Line {i + 1} amount in naira</span>
                        <span className="naira" aria-hidden="true">₦</span>
                        <input className="in in-amt" inputMode="decimal" placeholder="0.00" value={l.amount} disabled={phase !== 'edit'}
                          aria-invalid={!!fieldErr[i]!.amount} aria-describedby={fieldErr[i]!.amount ? `amt-err-${i}` : undefined} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} />
                      </label>
                      {lines.length > 1 && phase === 'edit' && (
                        <button type="button" className="btn btn-icon" aria-label={`Remove line ${i + 1}`} onClick={() => setLines((x) => x.filter((_, j) => j !== i))}><Minus className="ic" /></button>
                      )}
                    </div>
                    {fieldErr[i]!.amount && <span className="fld-err" id={`amt-err-${i}`}>{fieldErr[i]!.amount}</span>}
                  </Slip>
                ))}
              </ol>
              {phase === 'edit' && lines.length < MAX_LINES && (
                <button type="button" className="btn btn-ghost add-line" onClick={() => setLines((x) => [...x, { name: '', to: '', amount: '' }])}><Plus className="ic" />Add a line</button>
              )}

              <div className="terms">
                <label className="fld">
                  <span className="lbl">Lowest exchange rate you accept</span>
                  <span className="in-wrap"><span className="naira" aria-hidden="true">₦</span><input className="in in-amt" inputMode="decimal" value={floor} disabled={phase !== 'edit'} onChange={(e) => setFloor(e.target.value)} /><span className="unit">per US$1</span></span>
                  <span className="hint">{rate ? <>Today’s rate: <span className="mono">₦{money(BigInt(rate.buyUnits))}</span>, read <span className="mono">{wat(new Date(rate.readAt))}</span> WAT</> : 'Textile isn’t quoting right now'}</span>
                </label>
                <dl className="terms-figs">
                  <div><dt>Pays out</dt><dd className="mono">₦{money(owed)}</dd></div>
                  <div><dt>Costs about</dt><dd className="mono">{estUsdt !== null ? `$${money(estUsdt)}` : '–'}</dd></div>
                  <div><dt>Most it may spend</dt><dd className="mono">${money(maxUsdtIn)}</dd></div>
                  <div><dt>Network fee</dt><dd>about 0.7 CELO, from the owner’s wallet</dd></div>
                  <div><dt>Valid for</dt><dd>1 hour after signing</dd></div>
                </dl>
              </div>

              {phase === 'edit' && (problems.length > 0 || blockers.length > 0) && (
                <ul className="notes" role="status">
                  {[...problems, ...blockers].map((p) => <li key={p}>{p}</li>)}
                </ul>
              )}

              {(phase === 'running' || phase === 'done') && (
                <ol className="stages" aria-live="polite">
                  {stages.map((s) => (
                    <li key={s.key}><Check className="ic ok" />{s.text}{s.href && <> <a href={s.href} target="_blank" rel="noreferrer">Transaction<Out className="ic-s" /></a></>}</li>
                  ))}
                  {phase === 'running' && <li className="busy"><Dot className="ic pulse" />{stages.length === 0 ? 'Checking your signature…' : stages.length === 1 ? 'Booking the exchange rate…' : stages.length === 2 ? 'Sending the payment…' : 'Waiting for Celo to confirm it…'}</li>}
                </ol>
              )}
              {outcome && outcome.status !== 'paid' && <p className="refusal" role="alert"><Cross className="ic" />{outcome.sentence}</p>}
              {outcome?.status === 'paid' && <p className="done-line" role="status"><Check className="ic ok" />Paid exactly as signed. Each stamp links to a receipt you can send that person.</p>}

              <div className="actions">
                {phase !== 'done' ? (
                  <button type="button" className="btn btn-primary" disabled={!canSign} onClick={signAndRun}>
                    <Pen className="ic" />{phase === 'signing' ? 'Sign in your wallet…' : phase === 'running' ? 'The agent is paying…' : 'Sign and pay'}
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={() => { setPhase('edit'); setOutcome(null); setStages([]); setSignedSlip(null); setLines([{ name: '', to: '', amount: '' }]); }}>Write another payslip</button>
                )}
                {signedSlip && <span className="hint">Signed by {short(signedSlip.owner)} · {signedSlip.lines.length} line{signedSlip.lines.length === 1 ? '' : 's'}</span>}
              </div>
            </section>
          )}

          <section className="book" aria-labelledby="last-run">
            {last ? (
              <>
                <div className="book-head">
                  <h1 id="last-run" className="book-title">{drafting ? 'Last pay run' : 'Pay run'}, {watDay(new Date(last.at))} {wat(new Date(last.at))} WAT</h1>
                  {!drafting && (isOwner
                    ? <button type="button" className="btn btn-primary" onClick={() => setDrafting(true)}><Plus className="ic" />New payslip</button>
                    : <button type="button" className="btn btn-quiet" onClick={connect} disabled={connecting}><Wallet className="ic" />Connect the owner wallet to write</button>)}
                </div>
                <p className="book-sub">Every line below is one the owner signed. A PAID stamp means that person received the money; each has a receipt to send them.</p>
                <dl className="recon" aria-label="Signed against paid">
                  <div><dt>Owner signed</dt><dd>₦{money(signedTotal)}</dd></div>
                  <div><dt>Paid out</dt><dd>₦{money(BigInt(last.cngnPaid))}</dd></div>
                  <div><dt>Cost in dollars</dt><dd>${money(BigInt(last.usdtSpent))}</dd></div>
                  <div><dt>Rate per $1</dt><dd>₦{money(runRate)}{last.minRate && <small>lowest accepted ₦{money(BigInt(last.minRate))}</small>}</dd></div>
                </dl>
                <ol className={`slips${lastLines.length > COMPACT_AFTER ? ' compact' : ''}`}>
                  {lastLines.map((l, i) => <Slip key={i} n={i + 1} to={l.to} name={nameOf(l.to)} amount={l.amount} state={l.state} />)}
                </ol>
              </>
            ) : props.runs === null ? (
              <p className="empty">Celo didn’t answer, so past pay runs can’t be shown right now. Nothing here is a placeholder: reload in a moment.</p>
            ) : (
              <div className="empty">
                <h1 className="book-title">No pay runs yet</h1>
                <p>When the owner signs a payslip and the agent pays it, each person appears here with a PAID stamp.</p>
                {isOwner
                  ? <button type="button" className="btn btn-primary" onClick={() => setDrafting(true)}><Plus className="ic" />New payslip</button>
                  : <button type="button" className="btn btn-quiet" onClick={connect} disabled={connecting}><Wallet className="ic" />Connect the owner wallet to write</button>}
              </div>
            )}
          </section>

          <HowItPays payRun={props.payRun} owner={props.owner} last={last} session={session} feeLimit={feeCap ? BigInt(feeCap.limit) : null} />

          <section id="try" className="try" aria-label="Try to pay someone not on the payslip">
            <div className="try-row">
              <p><strong>Can the agent pay someone the owner didn’t sign for?</strong> Test it: we add a stranger to the owner’s signed payslip and ask Celo to pay it. Nothing is sent.</p>
              <button type="button" className="btn btn-quiet" onClick={askPayRun} disabled={tryState === 'asking'}>
                <Cross className="ic" />{tryState === 'asking' ? 'Asking Celo…' : 'Try to pay someone not on the payslip'}
              </button>
            </div>
            {tryState === 'error' && <p className="refusal" role="alert">Celo didn’t answer, so nothing was checked. Try again in a moment.</p>}
            {tryResult && <TryBook result={tryResult} nameOf={nameOf} />}
          </section>
        </div>

        <aside className="dk-side" aria-label="Rate, the agent's limits and the payroll balance">
          <section className="panel">
            <h2 className="panel-title">Exchange rate today</h2>
            <p className="big">{rate ? `₦${money(BigInt(rate.buyUnits))}` : '₦ ––'}<span className="big-unit"> per $1</span></p>
            <p className="meta">{rate ? `Textile FX, read ${wat(new Date(rate.readAt))} WAT` : 'Textile isn’t quoting right now'}</p>
          </section>
          <section className="panel">
            <h2 className="panel-title">What the agent can do</h2>
            {session ? (
              <dl className="facts">
                <div><dt>Pay</dt><dd>{session.calls.some((c) => c.to.toLowerCase() === props.payRun.toLowerCase() && c.selector === RUN_SELECTOR) ? 'only the people and amounts the owner signed' : 'nothing: it holds no permission to pay'}</dd></div>
                <div><dt>{session.live ? 'Allowed until' : 'Ended'}</dt><dd className={session.live ? '' : 'warn'}><span className="mono">{watDay(new Date(session.expiry))} {wat(new Date(session.expiry))}</span> WAT</dd></div>
                {feeCap && <div><dt>Network fees</dt><dd><span className="mono">{money(BigInt(feeCap.spentToday) / 10n ** 12n)} of {money(BigInt(feeCap.limit) / 10n ** 12n)}</span> CELO today</dd></div>}
              </dl>
            ) : <p className="meta">{props.ownerState ? 'The agent holds no permission on this wallet.' : 'Celo didn’t answer; the agent’s permission can’t be read right now.'}</p>}
          </section>
          <section className="panel">
            <h2 className="panel-title">Payroll balance</h2>
            {props.ownerState ? (
              <>
                <p className="big">${money(BigInt(props.ownerState.float))}</p>
                <p className="meta">Held in USD₮ by the payroll contract. Only a payslip the owner signed can spend it; only the owner can take it out. In the owner’s wallet: ${money(BigInt(props.ownerState.walletUsdt))}.</p>
                {isOwner && chainOk && (
                  <div className="fund">
                    <label className="fld"><span className="sr">Dollars (USD₮) to add</span><span className="in-wrap"><input className="in in-amt" inputMode="decimal" placeholder="0.00" value={fund} onChange={(e) => setFund(e.target.value)} disabled={!!funding && !funding.includes('declined')} /><span className="unit">USD₮</span></span></label>
                    <button type="button" className="btn btn-quiet" disabled={!parseNaira(fund) || (!!funding && !funding.includes('declined'))} onClick={addToFloat}>Add funds</button>
                    {funding && <p className="meta" role="status">{funding}</p>}
                  </div>
                )}
              </>
            ) : <p className="meta">Celo didn’t answer; the balance can’t be read right now.</p>}
          </section>
          <p className="read-at">Read from Celo at <span className="mono">{wat(new Date(props.readAt))}</span> WAT · owner <a className="mono" href={celoscanAddr(props.owner)} target="_blank" rel="noreferrer">{short(props.owner)}</a></p>
        </aside>
      </div>
    </>
  );
}
