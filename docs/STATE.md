# State
_Last verified: 2026-11-22 07:45 UTC (PayRun v2 mainnet run and refusal)_

**Thesis:** Albashi pays your freelancers in naira, and its agent can only pay the payslip you signed.
**Milestone:** M0 · Rigged (checkpoint 2026-11-23 05:24 UTC), with M1's contract and agent items already done · **Deadline:** 2026-12-07 09:00 UTC (time left: the clock line)
**Next action:** M1 "Owner desk in `apps/web`" (docs/PLAN.md): the owner signs a payslip in the browser and the agent runs it.
**Agent wallet on file (Loops House):** `0x1Bce3F6267983dfAb58CED6261EF05a28E168ce8` (D-011). ERC-8004: agent 10095, registered from it (E-013); the event's checker sees its tag (E-012).
**Blocked on:** nothing. Awaiting Celo DevRel's answer on whether the self-relaying agent EOA is the scored "agent wallet" (asked 2026-11-21 18:55 UTC).

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| PayRun v2 on Celo mainnet: pays a signed payslip exactly, from the owner's float, at no less than the signed rate | live run: ₦700 + ₦800 paid, 1.040028 USD₮ spent, rate 1,442.27 ≥ floor 1,427.85 | E-008, E-010 |
| PayRun refuses a payslip the owner didn't sign (one extra recipient) | `NotSigned` against mainnet state, and Altana's relay refused to price it | E-011 |
| Textile firm-quotes PayRun as the taker (EIP-1271 proof by the agent; float meets proof of funds) | live run | E-010 |
| Clean self-relay in product code (`apps/agent/src/relay.ts`): prepare → sign → simulate → submit, tagged | live run, `verifyTx` → `celo_3f5cac8c49f6` | E-010 |
| The owner's own transactions (approve, deposit, permission removal) tagged | `verifyTx` on each | E-009, E-011 |
| The session's call permissions on chain: `PayRun.run` on v2 + Porto's Orchestrator default | `canExecutePackedInfos` read after removing v1 | E-011 |
| Contract gate: fmt, lint (deny warnings), build (8,169 B), 33 tests; agent gate: lint, typecheck, 17 tests | local runs, commit 4b2144c | — |

## Deployed
| What | Network or environment | Address / URL | Last checked |
|---|---|---|---|
| PayRun v2 | Celo mainnet | `0xfa8d963525d5F28427B897A0C761C744A43e59Af` (source verified on Sourcify, runtime match) | 2026-11-22 07:40 UTC: 8,169 B; float 0.459972 = totalFloat = USD₮ held |
| PayRun v1 (retired; never send it USD₮) | Celo mainnet | `0x3Ef8f9A0dA701cE46b022b14E87315701D4bfeF7` | 2026-11-22: allowance 0, session permission removed |
| Public repo | GitHub | https://github.com/emmanuelist/albashi (CI: secrets scan) | 2026-11-21 19:45 UTC |
| Proof page (apps/web) | Vercel, project albashi | https://albashi.vercel.app | 2026-11-22 09:10 UTC: thesis alert, E-010 lines and E-011 refusal served from chain reads; `/.well-known/agent-registration.json` 200 JSON (agent 10095) |

## Broken or unverified
- PayRun is not audited (source verified on Sourcify)
- The refusal is a simulation against mainnet, not a mined reverted transaction (Altana's relay won't price one)
- Porto's default "any function on the Orchestrator" session permission: not audited by us
- The session grant still goes through Altana's relay, untagged (C-5 qualified)
- One run's relay fee (0.667 CELO) nearly fills the SDK's default 1 CELO/day fee cap: a real agency's session needs a wider one
- No real person paid yet (our own test wallets only); cNGN cash-out for recipients unverified

## Claims not yet verified
- C-5 "every Albashi transaction carries our tag": true only for transactions Albashi sends itself

## Open questions
- Is the self-relaying agent EOA the event's "one agent wallet", with customer-wallet activity credited to us? (Celo DevRel, asked)
- Which agency is the named user, and can its freelancers cash out cNGN? (user, by 2026-11-27)
