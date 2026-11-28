# State
_Last verified: 2026-11-28 14:10 UTC_

**Thesis:** Albashi pays your freelancers in naira, and its agent can only pay the payslip you signed.
**Milestone:** M1 done (E-018: a real freelancer paid). M2's reversal beats done on mainnet (E-019); its outside-agency run is the user's. M3 (UI pass, due 3 Dec) in progress: critique 24 → 28/40; benchmark 28 Nov fix list in PLAN (fixes 1-5) · **Deadline:** 2026-12-07 09:00 UTC
**Next action:** M3 fixes 2-3 (proof page first screen shows E-018; revoke visible to a stranger on the desk), then fix 4, the demo video, recorded with apps/agent/scripts/drive-desk.ts and described as signed by the owner's wallet (D-015).
**Submission:** register fully with the video before AskBots round 2 (event page: Fri 4 Dec; Celo's 26 Nov message said Thu 3 Dec: be ready by 3 Dec). Draft answers: internal/SUBMISSION.md (updated 28 Nov). Altana product review filed: https://github.com/altananetwork/altana-sdk/issues/176.
**People (user):** an outside agency's payroll with several freelancers (M2, traction); Tommy's cNGN cash-out to a bank (which app, fees, time); Celo DevRel's answer on the agent wallet (asked 21 Nov); report the wallet-security warning seen on albashi.vercel.app in MetaMask.
**Agent wallet on file:** `0x1Bce3F6267983dfAb58CED6261EF05a28E168ce8` (D-011), ERC-8004 agent 10095 (E-013).

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| A real freelancer paid from the deployed desk: ₦1,500 to Tommy Braz, exactly the signed line, tagged inner (`altana,celo_…`) and outer | on-chain read, verifyTx, his balance | E-018 |
| The owner stopped the agent from the desk (revoke, tagged); the agent's next call was refused by Altana's relay; re-granted, fee cap restored to 3 CELO/day | getKey, relay simulation before/after | E-019 |
| `spike/verify.mjs` checks E-018 and E-019 read-only: 8/8 PASS | node verify.mjs, 28 Nov | README |
| Live refusal on the desk and the proof page: NotSigned (stranger added) and NotOwner (stranger sends) | /api/try, eth_call | E-011 |
| Desk: payroll words, names, history, pay again, signing summary, stop the agent; receipt page per payment; shared tokens on a 4px scale | rendered 320-1440, ui-audit clean | commit 5cc6abb |
| Altana SDK 1.2.0 in agent and web; runs carry Altana's inner tag and our outer tag | mined run E-018 | commit 23a6074 |
| Contracts 33 tests; agent 20 + 21 live; web 11; CI green | local + CI | — |

## Deployed
| What | Network or environment | Address / URL | Last checked |
|---|---|---|---|
| PayRun v2 | Celo mainnet | `0xfa8d963525d5F28427B897A0C761C744A43e59Af` (Sourcify partial match) | 2026-11-28: payroll balance 0.17 USD₮ |
| Proof page, desk, receipts | Vercel (auto-deploys from main) | https://albashi.vercel.app | 2026-11-28 13:40 UTC: all routes 200 |
| Agent route keys | Vercel env (production) | AGENT_KEY, SESSION_KEY, SESSION_JSON (unchanged by the E-019 re-grant) | E-018 used them |
| Agent session on the owner wallet | Celo mainnet | PayRun.run only, until 21 Jan 2027, 3 CELO/day fee cap | 2026-11-28 13:00 UTC |

## Broken or unverified
- No demo video yet (Altana's "shown in the demo" requirements depend on it)
- No outside agency has run payroll; traction is three runs from the team's own agency wallet
- cNGN cash-out to a Nigerian bank not yet done by a real freelancer
- PayRun not audited; the refusal is shown as a simulation against mainnet, not a mined revert
- Grant, renewal and revoke through Altana's relay are untagged even on SDK 1.2.0 (only execute() tags)
- Some networks can't reach one of Vercel's edge clusters (CONTEXT): the site can hang locally while it serves elsewhere
- Owner wallet holds ~9.6 CELO the user sent; ~6.8 returns after the hackathon (relay fees until then)

## Open questions
- Is the self-relaying agent EOA the event's "one agent wallet" for the Altana track? (Celo DevRel, asked 21 Nov, acknowledged 23 Nov)
