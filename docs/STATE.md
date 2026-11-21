# State
_Last verified: 2026-11-21 20:20 UTC (self-relay spike committed after this rewrite)_

**Thesis:** Albashi pays your freelancers in naira, and its agent can only pay the payslip you signed.
**Milestone:** M0 · Rigged (checkpoint 2026-11-23 05:24 UTC) · **Deadline:** 2026-12-07 09:00 UTC (time left: the clock line)
**Next action:** Design bar: capture the best payroll and payslip interfaces into `internal/design/bar/`, then `impeccable shape` (PLAN M0, due 2026-11-23 05:24 UTC). README is live (verify.mjs passes from a clean clone).
**Blocked on:** nothing. Awaiting Celo DevRel's answer on whether the self-relaying agent EOA is the scored "agent wallet" (asked 2026-11-21 18:55 UTC).

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Altana session on Celo mainnet: grant with allowlist, caps and expiry | two live runs | E-001, E-006 |
| Agent swaps USD₮ → cNGN on Textile from the owner's Altana wallet | live runs | E-002, E-005 |
| Agent pays cNGN to another wallet | first run | E-003 |
| **Self-relay:** the agent EOA submits the session intent itself; our tag sits at the tail; `verifyTx` reads `celo_3f5cac8c49f6` | `spike/selfrelay.mjs --live` | E-005 |
| USD₮ cap refuses an over-cap transfer | same run (by elimination: fee cap had room) | E-007 |
| Revoke in one tx stops the agent; off-allowlist calls refused | both runs | E-004, E-007 |

## Deployed
| What | Network or environment | Address / URL | Last checked |
|---|---|---|---|
| Public repo | GitHub | https://github.com/emmanuelist/albashi (CI: secrets scan) | 2026-11-21 19:45 UTC |
| App | — | nothing deployed yet | |

## Broken or unverified
- The pay-run contract doesn't exist yet, so the thesis (C-1) is unverified
- The owner's grant and revoke still go through Altana's relay, untagged (C-5 qualified)
- Self-relay in product code: the spike intercepts the SDK's last relay request; M1 needs a clean prepare → sign → submit path
- cNGN cash-out for recipients: unverified (ask a real freelancer)

## Claims not yet verified
- C-1 the thesis: needs the pay-run contract (D-002) and a mainnet refusal of an off-payslip payment

## Open questions
- Is the self-relaying agent EOA the event's "one agent wallet", with customer-wallet activity credited to us? (Celo DevRel, asked)
- Which agency is the named user, and can its freelancers cash out cNGN? (user, by 2026-11-27)
