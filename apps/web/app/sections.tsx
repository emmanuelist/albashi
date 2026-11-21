// Below the first viewport: how a pay run works (and which parts already run on mainnet), the README's
// verification run live against Celo, every proof with its time, and the limits. Every sentence here has a
// row in docs/EVIDENCE.md or says plainly that the part is not built.
import { Fragment } from 'react';
import {
  ATTRIBUTION_CODE,
  EVIDENCE,
  OWNER_TXS,
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
    text: 'Who gets paid, how much each, and the lowest naira rate you accept for a dollar.',
    notBuilt: 'the payslip and the pay-run contract that holds it',
  },
  {
    n: '02',
    title: 'You give the agent a session',
    text: 'From your own Altana wallet. It may call only the contracts you allow, up to a daily cap, until it expires.',
    proven: [tx('grant', OWNER_TXS.grant), tx('grant', OWNER_TXS.grant2)],
  },
  {
    n: '03',
    title: 'The agent converts and pays',
    text: 'A firm Textile FX quote turns USD₮ into cNGN, and the agent pays it out. When the agent sends a transaction itself, it carries Albashi’s attribution tag.',
    proven: [tx('swap', EVIDENCE.swapViaRelay), tx('payout', EVIDENCE.payout), tx('tagged swap', EVIDENCE.swapSelfRelay)],
    notBuilt: 'paying each line of a signed payslip',
  },
  {
    n: '04',
    title: 'Anything else is refused, and you can stop it in one transaction',
    text: 'Over the cap, outside the allowlist, or after you revoke, the session refuses before anything reaches Celo.',
    proven: [
      tx('revoke', OWNER_TXS.revoke),
      tx('revoke', OWNER_TXS.revoke2),
      { label: 'refusal log', href: SPIKE_RUN_LOG },
      { label: 'over-cap log', href: REFUSAL.proof },
    ],
    notBuilt: 'refusing a payee who is not on the payslip',
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
];

const LIMITS = [
  'These are proofs of the parts, not the product: the pay-run contract and the owner’s app are not built yet.',
  'The top alert’s promise, that the agent will only pay the payslip you sign, is a goal until the pay-run contract refuses an off-payslip payment on mainnet.',
  'Every run so far moved one US dollar.',
  'The owner’s own setup transactions (create wallet, grant, revoke) still go through Altana’s relay, so they carry no attribution tag.',
  'Whether freelancers can easily cash cNGN out to naira is still being checked with a real user.',
  'No audit.',
];

export default async function Sections() {
  const [run, ...times] = await Promise.all([cachedSelfRelayChecks(), ...PROOFS.map((p) => (p.hash ? cachedTxTime(p.hash as `0x${string}`) : Promise.resolve(null)))]);

  return (
    <>
      <section id="how" className="sheet" aria-labelledby="how-title">
        <p className="kicker">How a pay run works</p>
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
        <p className="kicker">Proof on Celo</p>
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
        <p className="kicker">Limits</p>
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
