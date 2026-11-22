// Below the first viewport: how a pay run works (and which parts already run on mainnet), the README's
// verification run live against Celo, every proof with its time, and the limits. Every sentence here has a
// row in docs/EVIDENCE.md or says plainly that the part is not built.
import { Fragment } from 'react';
import {
  ATTRIBUTION_CODE,
  EVIDENCE,
  OWNER_TXS,
  PAYSLIP_REFUSAL,
  REFUSAL,
  REPO_URL,
  SPIKE_RUN_LOG,
  celoscan,
  short,
  wat,
  watDay,
} from './lib/proof';
import { cachedSelfRelayChecks, cachedTxTime } from './lib/cached';

type Ref = { label: string; href: string };

function Refs({ refs }: { refs: Ref[] }) {
  return (
    <>
      {refs.map((r, i) => (
        <Fragment key={r.href + r.label}>
          {i > 0 && ' · '}
          <a className="ref" href={r.href} target="_blank" rel="noreferrer">
            {r.label}
          </a>
        </Fragment>
      ))}
    </>
  );
}

type Step = { n: string; title: string; text: string; proven?: Ref[]; notBuilt?: string };

const tx = (label: string, hash: string): Ref => ({ label: `${label} ${short(hash)}`, href: celoscan(hash) });

const STEPS: Step[] = [
  {
    n: '01',
    title: 'You sign the payslip',
    text: 'Who gets paid, how much cNGN each, the most USD₮ to spend, the lowest naira rate you accept, and a deadline. You keep a USD₮ float in the pay-run contract that only a payslip you signed can spend.',
    proven: [tx('float deposit', EVIDENCE.floatDeposit), tx('pay-run contract', EVIDENCE.payRunDeploy)],
    notBuilt: 'the app where you write and sign it (the first payslip was signed by a script)',
  },
  {
    n: '02',
    title: 'You give the agent a session',
    text: 'From your own Altana wallet. Its only permitted call is the pay-run contract’s run, until it expires.',
    proven: [tx('grant', EVIDENCE.payRunGrant), tx('earlier grant', OWNER_TXS.grant)],
  },
  {
    n: '03',
    title: 'The agent converts and pays each line',
    text: 'The pay-run contract fills a firm Textile FX quote, checks the rate it got against your floor, and pays exactly the lines you signed. The agent sends the transaction itself, with Albashi’s attribution tag.',
    proven: [tx('pay run', EVIDENCE.payRun)],
  },
  {
    n: '04',
    title: 'Anything you didn’t sign is refused, and you can stop it in one transaction',
    text: 'A payslip with a payee you didn’t sign is refused before anything is sent. After you revoke, the session refuses everything.',
    proven: [
      { label: 'refusal log', href: PAYSLIP_REFUSAL.proof },
      tx('revoke', OWNER_TXS.revoke),
      tx('revoke', OWNER_TXS.revoke2),
      { label: 'over-cap log', href: REFUSAL.proof },
    ],
  },
];

const PROOFS: { id: string; what: string; hash?: string; log?: string }[] = [
  { id: 'E-001', what: 'The owner granted the agent a session: allowlist, a 2 USD₮ daily cap, a one-hour expiry', hash: OWNER_TXS.grant },
  { id: 'E-002', what: 'The agent swapped 1 USD₮ for cNGN on Textile, from the owner’s Altana wallet', hash: EVIDENCE.swapViaRelay },
  { id: 'E-003', what: 'The agent paid that cNGN to another wallet', hash: EVIDENCE.payout },
  { id: 'E-004', what: 'The owner revoked the session in one transaction; the agent’s next action was refused', hash: OWNER_TXS.revoke },
  { id: 'E-005', what: 'The agent’s own wallet sent a swap with Albashi’s attribution tag at the end', hash: EVIDENCE.swapSelfRelay },
  { id: 'E-006', what: 'A second session on a fresh wallet, granted and revoked', hash: OWNER_TXS.grant2 },
  { id: 'E-007', what: 'A transfer over the daily cap was refused before it was sent', log: REFUSAL.proof },
  { id: 'E-008', what: 'The agent deployed the pay-run contract, tagged', hash: EVIDENCE.payRunDeploy },
  { id: 'E-009', what: 'The owner deposited a 1.5 USD₮ float into it, from its own key, tagged', hash: EVIDENCE.floatDeposit },
  { id: 'E-010', what: 'The first pay run: ₦700 and ₦800, exactly the signed lines, at ₦1,442.27 per USD₮ (signed floor ₦1,427.85)', hash: EVIDENCE.payRun },
  { id: 'E-011', what: 'The same payslip with a payee added was refused (NotSigned) before anything was signed or sent', log: PAYSLIP_REFUSAL.proof },
  { id: 'E-013', what: 'The agent registered its ERC-8004 identity, agent 10095', hash: EVIDENCE.erc8004 },
];

const LIMITS = [
  'One pay run so far, ₦1,500 to Albashi’s own test wallets. The payslip was signed by a script; the owner’s app isn’t built yet.',
  'The refusal was checked against Celo mainnet’s state by the pay-run contract and by Altana’s relay, which would not sign it. No failed transaction was mined.',
  'The session grant goes through Altana’s relay, so it carries no attribution tag. Every transaction Albashi sends itself does.',
  'Altana’s wallet code (Porto) gives every session key a standing permission on its Orchestrator, used to pay relay fees. We haven’t audited it.',
  'Whether freelancers can easily cash cNGN out to naira is still being checked with a real user.',
  'No audit.',
];

export default async function Sections() {
  const [run, ...times] = await Promise.all([cachedSelfRelayChecks(), ...PROOFS.map((p) => (p.hash ? cachedTxTime(p.hash as `0x${string}`) : Promise.resolve(null)))]);

  return (
    <>
      <section id="how" className="sheet" aria-labelledby="how-title">
        <h2 id="how-title" className="sheet-title">Four steps, and which of them already run on Celo mainnet.</h2>
        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.n} className="step">
              <span className="step-n" aria-hidden="true">{s.n}</span>
              <div className="step-body">
                <h3 className="step-title">{s.title}</h3>
                <p className="step-text">{s.text}</p>
                {s.proven && (
                  <p className="status status-proven">
                    <span className="status-label">On mainnet</span> <Refs refs={s.proven} />
                  </p>
                )}
                {s.notBuilt && (
                  <p className="status status-pending">
                    <span className="status-label">Not built yet</span> {s.notBuilt}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="proof" className="sheet" aria-labelledby="proof-title">
        <h2 id="proof-title" className="sheet-title">Don’t take the page’s word for it.</h2>
        <p className="sheet-lede">
          This page checked the payment its agent sent itself (E-005) against Celo mainnet; the result and when it ran are
          below. The same checks run from the repo with no wallet and no keys.
        </p>

        <div className="checks" role="group" aria-label="Live checks of E-005">
          <p className="checks-head">
            <span>E-005 · {short(EVIDENCE.swapSelfRelay)}</span>
            <span>{run ? `checked ${watDay(run.at)} ${wat(run.at)} WAT` : 'Celo did not answer'}</span>
          </p>
          {run ? (
            <ul className="checks-list">
              {run.checks.map((c) => (
                <li key={c.what} className={c.ok ? 'pass' : 'fail'}>
                  <span className="verdict">{c.ok ? 'PASS' : 'FAIL'}</span>
                  <span className="check-what">{c.what}</span>
                  <span className="check-detail">{c.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="checks-down">
              The checks could not reach Celo just now. Open <a href={celoscan(EVIDENCE.swapSelfRelay)}>the transaction on Celoscan</a>{' '}
              or run them yourself below.
            </p>
          )}
        </div>

        <pre className="command" aria-label="Run the checks yourself">
          <code>{`git clone ${REPO_URL} && cd albashi/spike
npm ci
node verify.mjs`}</code>
        </pre>

        <h3 className="sub-title">Every proof so far</h3>
        <ol className="proofs">
          {PROOFS.map((p, i) => {
            const at = times[i];
            return (
              <li key={p.id} className="proof">
                <span className="proof-id">{p.id}</span>
                <span className="proof-what">{p.what}</span>
                <span className="proof-when">{at ? `${watDay(at)} ${wat(at)}` : p.log ? 'not sent' : ''}</span>
                <a className="proof-ref" href={p.hash ? celoscan(p.hash) : p.log} target="_blank" rel="noreferrer">
                  {p.hash ? short(p.hash) : 'run log'}
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <section id="limits" className="sheet" aria-labelledby="limits-title">
        <h2 id="limits-title" className="sheet-title">What isn’t true yet.</h2>
        <ul className="limits">
          {LIMITS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <footer className="foot">
        <p>
          <span lang="ha">Albashi</span> is Hausa for salary. Built on Celo with Textile FX and Altana for Agents Open for Business.
        </p>
        <p>
          <a href={REPO_URL}>Source and docs</a> · attribution code <code>{ATTRIBUTION_CODE}</code>
        </p>
      </footer>
    </>
  );
}
