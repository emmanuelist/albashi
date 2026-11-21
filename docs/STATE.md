# State
_Last verified: 2026-11-21 19:45 UTC at the foundation commit_

**Thesis:** Albashi pays your freelancers in naira, and its agent can only pay the payslip you signed.
**Milestone:** M0 · Rigged (checkpoint 2026-11-23 05:24 UTC) · **Deadline:** 2026-12-07 09:00 UTC (time left: the clock line)
**Next action:** Self-relay spike: submit a session-signed intent from our own EOA to the Orchestrator with the tag at the tail, then check `verifyTx` (PLAN M0). Needs the user's OK to spend ≈ $1.50 (mostly the session-key registration).
**Blocked on:** nothing for building. The organizers' answer on attribution through self-relay is pending (user to ask, by 2026-11-23).

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Altana session on Celo mainnet: grant with allowlist, cap and expiry | `spike/spike.mjs --live`, tx confirmed | E-001 |
| Agent swaps USD₮ → cNGN on Textile from the Altana wallet | same run | E-002 |
| Agent pays cNGN to another wallet | same run | E-003 |
| Revoke in one tx stops the agent; off-allowlist call refused | same run | E-004 |

## Deployed
| What | Network or environment | Address / URL | Last checked |
|---|---|---|---|
| nothing yet | | | |

## Broken or unverified
- Attribution through Altana's relay: the tag isn't at the tail, so the indexer won't credit it (E-002; fix D-003, unverified)
- USD₮ cap enforcement: the refusal named the CELO fee cap, not USD₮ (C-4)
- Self-relay: the Orchestrator accepts any caller (verified source), but the SDK path to a signed-but-unsent intent is unverified
- cNGN cash-out for recipients: unverified (ask a real freelancer)

## Claims not yet verified
- C-1 the thesis: needs the pay-run contract (D-002) and a mainnet refusal
- C-4 USD₮ cap: needs a re-test with the fee cap set wide
- C-5 every tx tagged: false today; needs D-003

## Open questions
- Is a self-relayed agent EOA the event's "one agent wallet", with customer-wallet activity credited to us? (Celo DevRel; user asking)
- Which agency is the named user, and can its freelancers cash out cNGN? (user)
