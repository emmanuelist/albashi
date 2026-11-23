# State
_Last verified: 2026-11-22 23:30 UTC (handoff; the user returns Saturday 28 Nov)_

**Thesis:** Albashi pays your freelancers in naira, and its agent can only pay the payslip you signed.
**Milestone:** M0 build work done (two ops items are the user's); M1 done except "one real person paid" · **Deadline:** 2026-12-07 09:00 UTC (time left: the clock line)
**Next action (28 Nov):** the UI list in order: (1) the proof page's two round buttons link to `#run`/`#try`, which don't exist: "Run payroll" → /desk, "Try" → PayRun's live refusal landing as a DECLINED alert; (2) revoke on the desk (high effort; a re-grant after revoke costs a KeyStore registration, ~10 CELO); (3) the proof page's live checks still verify spike E-005: point them at E-016; (4) a freelancer receipt page per paid line; (5) M3 pass incl. cold judges vs Syncly.
**People (user):** the named agency for M1/M2 was due 27 Nov and lands after this break: M1's "real person paid" and M2 now start no earlier than 28 Nov. Celo DevRel's answer on the agent wallet (asked 21 Nov). Report the MetaMask/Blockaid phishing warning on albashi.vercel.app.
**Agent wallet on file (Loops House):** `0x1Bce3F6267983dfAb58CED6261EF05a28E168ce8` (D-011). ERC-8004 agent 10095 (E-013). Playground: all checks pass (E-014).

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| A pay run from the deployed desk: signed in MetaMask, run by the agent's Vercel route, tagged; ₦750 + ₦800 paid exactly | on-chain read, verifyTx | E-016 |
| PayRun v2 pays a signed payslip exactly from the owner's float, at no less than the signed rate | two mainnet runs | E-010, E-016 |
| PayRun refuses a payslip the owner didn't sign; anyone can ask it live at /api/try (NotSigned), free | eth_call, live tests | E-011, docs/evidence/demo-payslip.json |
| Owner desk /desk: last run as stamped slips from PayRun's events; limits, float, session read from chain; owner-only editor → sign → streamed run | deployed, finish review resolved | D-012; commits cb06b36..d5e2ee5 |
| Session: may call only PayRun.run, until 21 Jan 2027; relay-fee cap 3 CELO/day | `getKey`, `spendInfos` on chain | E-015 |
| Responsive: no sideways scroll or clipping at 320–1920 px on both pages; desk type in rem; alert text ≥ 14px | Playwright measurements, 22 Nov | commit d5e2ee5 |
| Git push to main deploys production (Vercel root `apps/web`, Next.js) | Vercel status on d5e2ee5 + routes 200 | D-013 |
| Contracts 33 tests; agent 19 + 3 live; web 11; CI secrets green | local + CI | — |

## Deployed
| What | Network or environment | Address / URL | Last checked |
|---|---|---|---|
| PayRun v2 | Celo mainnet | `0xfa8d963525d5F28427B897A0C761C744A43e59Af` (Sourcify runtime match) | 2026-11-22 22:45 UTC: float 0.035 USD₮ |
| Proof page + owner desk | Vercel (auto-deploys from main) | https://albashi.vercel.app, /desk | 2026-11-22 23:30 UTC: all routes 200 |
| Agent route keys | Vercel env (production) | AGENT_KEY, SESSION_KEY, SESSION_JSON (session to 21 Jan 2027) | the E-016 run used them |
| ERC-8004 registration file | Vercel | /.well-known/agent-registration.json | 200 |

## Broken or unverified
- Proof page: the two round buttons on its first screen go nowhere (`#run`, `#try`)
- MetaMask warns "phishing or wallet-draining" on albashi.vercel.app (not on MetaMask's public list; likely Blockaid; unreported)
- No real person paid yet (our test wallets only); cNGN cash-out unverified
- Revoke exists only as a spike script, not in the desk
- PayRun not audited; refusal shown as a simulation against mainnet, not a mined revert
- The session grant goes through Altana's relay, untagged
- Owner wallet holds ~10.4 CELO the user sent for a re-registration that wasn't needed: return on request

## Open questions
- Is the self-relaying agent EOA the event's "one agent wallet", and is self-relay fine for the Altana track? (Celo DevRel, asked 21 Nov, acknowledged 23 Nov: "will check"; the playground's own checker already sees its tag, E-012)
- Which agency is the named user, and can its freelancers cash out cNGN? (user; was due 27 Nov)
