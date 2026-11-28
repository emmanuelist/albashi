# Plan
Build window: 2026-11-20T14:00Z → 2026-12-07T09:00Z
Started: 2026-11-21T15:40Z
Deadline source: https://www.loops.house/agents-open-for-business ("Mon 7 Dec, 09:00 GMT: submissions close"). Buffer: 10% of the window, at least 2 hours and at most 24. Freeze: 80% of the window, or 48 hours before the deadline, whichever is later.

| # | Milestone | When | Exit criteria (a stranger could check these) | Due | Status |
|---|---|---|---|---|---|
| M0 | Rigged | 10% | D-001 recorded; riskiest dependency spiked with evidence; self-relay proven (a tagged tx credited to our code); repo public; a hello-world deployed; design direction locked before any UI code: the best interfaces in the category captured into `internal/design/bar/`, and `impeccable shape` run | 2026-11-23 05:24 UTC | in progress |
| M1 | Walking skeleton | 40% | On Celo mainnet: the owner signs a payslip → the pay-run contract records it → the agent gets a Textile quote and pays one real person in cNGN, through the owner's Altana session, self-relayed and tagged. The payslip component renders that run's real data, chosen from three variants | 2026-11-27 22:36 UTC | |
| M2 | Core claim | 65% | A named agency's real pay run end to end; the reversal beat on mainnet: the agent tries to pay someone not on the payslip (or below the rate floor) and the contract refuses; the owner revokes and the agent is stopped | 2026-12-01 20:56 UTC | |
| M3 | UI pass | 75% | `impeccable critique` and `polish` findings fixed; motion pass done; `ui-audit.mjs` shows no FAIL lines on the deployed app; first screen scores 3 on benchmark's first-screen dimension against the best reference | 2026-12-03 10:40 UTC | |
| M4 | Proof surface | freeze | README proof section; every claim has a verified row in the claims table; demo video recorded on the finished UI; benchmark run | 2026-12-05 09:00 UTC | |
| M5 | Submitted | deadline − buffer | Form submitted with the verbatim thesis; preflight passed from a phone on cellular | 2026-12-06 09:00 UTC | |

## Work items (sprint profile)
### M0 · Rigged (due 2026-11-23 05:24 UTC)
- [x] Mainnet spike: an Altana session converts USD₮→cNGN on Textile and pays out; revoke stops it. Done: E-001..E-004.
- [x] Foundation: rules, docs, clock, CI. Done when the cold-start test passes from the repo alone.
- [x] **Self-relay spike.** Done 2026-11-21: E-005 (tag at the tail, sent from the agent EOA). Done when a session-signed intent submitted by *our* EOA to the Orchestrator lands on mainnet and `verifyTx` returns `celo_3f5cac8c49f6` (evidence E-005). Needs the user's OK: spends ≈ $1.50 (a new session-key registration ≈ 20 CELO, plus gas and a $1 Textile swap that comes back as cNGN).
- [x] USD₮ cap re-test with the fee cap set wide. Done: E-007 (refused while the fee cap had room; the SDK's message names the fee token regardless). Done when a transfer over the USD₮ cap is refused with an error naming USD₮ (E-006). Can share the self-relay spike's run.
- [x] Repo public at github.com/emmanuelist/albashi before the AskBots round on 2026-11-24 14:00 UTC. Done 2026-11-21: CI (secrets scan) green on bebb78b.
- [x] A hello-world `apps/web` deployed; its URL in STATE. Done 2026-11-22: the proof page at https://albashi.vercel.app (real mainnet data, UI audit 26/26 PASS); CI web job green on 1df6d50.
- [x] Design bar: the best payroll and payslip interfaces captured into `internal/design/bar/`; `impeccable shape` run; the direction recorded as a decision. Done 2026-11-22: 8 references in `internal/design/bar/`, comp-2 approved, D-007.
- [ ] **ops · attribution answer.** User sends the self-relay and agent-wallet question to Celo DevRel (DM) and Altana's Telegram. Owner: the user. By 2026-11-23. If there's no reply by 2026-11-23 18:00 UTC, post it in t.me/celoagenthackathons.
- [ ] **ops · named user.** A named agency (name, number of freelancers, pay cadence) commits to a real pay run before 2026-11-27, and one of its freelancers says how they'd cash out cNGN. Owner: the user.

### M1 · Walking skeleton
- [x] **Pay-run contract** with failure-path tests: a recipient not on the payslip, an amount over it, a rate below the floor, an expired, cancelled or replayed payslip, a call that isn't a reactor fill, one owner spending another's float. Done 2026-11-22: PayRun v2 (D-010), 33 tests + 3 mainnet fork checks; deployed E-008.
- [x] **Agent path in product code:** Textile firm quote with PayRun as the taker, a clean prepare → sign → simulate → submit self-relay (no SDK interception), tagged. Done 2026-11-22: E-010 (`apps/agent/src/relay.ts`, `scripts/proof-run.ts`).
- [x] **First mainnet pay run and refusal, to our own test wallets.** Done 2026-11-22: E-010 (₦700 + ₦800, exactly the signed lines), E-011 (`NotSigned`).
- [x] **Owner desk in `apps/web`** (done 2026-11-22: E-016, a run signed in MetaMask on albashi.vercel.app/desk, run by the agent, tagged): the owner writes and signs a payslip in the browser, the agent runs it, and the page shows that run from chain. The payslip/run component renders real data and is chosen from three variants (`impeccable generate 3`). Done when a run started from the deployed page lands on mainnet, tagged.
- [x] **One real person paid** in cNGN. Done 2026-11-28: E-018, ₦1,500 to Tommy Braz (photographer), run from the deployed desk, tagged inner and outer.
- [x] **PayRun v2 source verified**, so judges can read what pays. Done 2026-11-22 on Sourcify (runtime match); Blockscout can't match the tagged creation input (CONTEXT trap).
- [x] **Proof page and README:** state the thesis as true where C-1 allows, and add the E-010 run and E-011 refusal as alerts. Done 2026-11-22: deployed, served from chain reads (commit 9b3c907).

### M2 · Core claim
- [x] **Revoke on mainnet from the desk, and the agent refused after it.** Done 2026-11-28: E-019 (stop, relay refuses the unknown key, re-grant, agent reaches PayRun again).
- [x] **Refusal of a payee the owner didn't sign**, live on the desk (eth_call against mainnet: NotSigned; a stranger sending the payslip: NotOwner). A mined reverted transaction isn't possible through Altana's relay (C-1 qualification).
- [ ] **ops · a named outside agency's real pay run.** Owner: the user.
- [ ] Tommy's cash-out to a Nigerian bank: which app, fees, time (owner: the user, with Tommy); fills the receipt's bank section.

### Layer 1 · Infrastructure for other agents (about 2–5 Dec, after the core claim; D-008)
- [ ] (placeholder: itemised when M2 closes) corridor-sdk, x402 payout endpoint held to the pay-run contract, `/.well-known/agent.json`, ERC-8004 registration.
- [ ] **ops · Self Agent ID.** User registers the agent with their own ID in the Self app once the agent EOA is final. Owner: the user.
- [x] **ops · Prezenti terms.** Done 2026-11-22: Frontier open to 29 Dec; an individual in Nigeria is eligible; no rule against hackathon entries; the 80% is released against Attachment A milestones "easily verifiable by Prezenti", delivered within 4 months (notes in internal/research/layer1-2026-11-22.md).
- [ ] **ops · cost log.** Keep a running log of project costs (gas, hosting, generation credits, domains) for a possible Prezenti expense certification. Owner: the user, with Claude adding the onchain gas from the evidence runs.
- [ ] Apply to Frontier as soon as the infrastructure layer is live on mainnet (about 5 Dec): grants are rolling and only ~4-6 are expected.

## Cut list
Things deliberately not being built. Each entry links the DECISIONS entry that cut it.
- Self Agent ID and Agent Vault tracks — D-001
