# Decisions
Append-only. To change a decision, add a new entry that supersedes it.

## D-001 · Build Albashi: agency payroll in cNGN, for Stablecoin Corridors + Altana Agent Wallets · 2026-11-21 · accepted
**Context:** "Agents Open for Business" (Celo, Loops House) has four tracks, and a project can win at most two. Stablecoin Corridors and Altana are scored on the same four criteria: execution, value proposition, tagged onchain traction, and a named user with a real job done (25% each).
**Decision:** A payroll agent for a small agency. The client pays the agency in USD₮; the agent converts to cNGN on Textile FX and pays each freelancer, acting from the owner's Altana wallet under a session key (cap, allowlist, expiry, one-transaction revoke). Target user: freelancers and small agencies paid in dollars who want naira.
**Alternatives:** A freelancer's own wallet sweeping income into naira (rejected: every freelancer must set up a wallet before anything counts). A client-side payer abroad (rejected: a foreign client is harder to reach as a named user). Self Agent ID and Agent Vault tracks (skipped: at most two wins count, and Agent Vault is the least tied to Celo).
**Consequences:** Real users are half the score, so a named agency must run a real pay run by M2. Recipients must be able to use cNGN (cash-out path still to be confirmed with a real freelancer).
**Evidence:** internal/research/DOSSIER.md (Decision, sections 5–7); mainnet spike E-001..E-004.

## D-002 · Claim A: "its agent can only pay the payslip you signed" — needs a pay-run contract · 2026-11-21 · accepted
**Context:** Altana's session allowlist is per contract, not per recipient. A session allowed to call cNGN directly could pay anyone within its cap, so "can only pay the people you approved" would be false.
**Decision:** Add a pay-run contract. The owner signs the payslip (recipients, amounts, minimum cNGN-per-USD₮ rate); the contract pays only that list, at that rate or better. The agent's session may call only the pay-run contract and Textile's reactor, never cNGN directly.
**Alternatives:** The narrow claim B ("inside a spending cap you set and can revoke"), which is true with no contract work but restates Altana's own feature and gives a weaker reversal beat.
**Consequences:** About a day of contract work plus tests, in M1. The reversal beat becomes "the agent tries to pay someone not on the payslip, and the contract refuses."
**Evidence:** internal/research/DOSSIER.md (claim break test); the session permission types in `@altananetwork/sdk` 1.1.0 `internal/sessions.d.ts` (`CallPermission` = `{ to }` / `{ signature }`).

## D-003 · Self-relay session intents so the attribution tag sits at the transaction's tail · 2026-11-21 · accepted (revisit if organizers say relayed txs are credited)
**Context:** Through Altana's relay, our tag lands inside the calldata, not at the tail of the outer transaction (E-002, E-003: `verifyTx` returns null). Celo's indexer spec reads the tag only from the tail of the outer `tx.input`, plus ERC-4337 bundles, which Altana's relay isn't. The event also ties the score to one agent wallet.
**Decision:** Albashi's agent EOA submits the session-signed intents to the Orchestrator (`0xaf140d0416a994aebb3fa6212b16ce6700f09751`) itself, with `celo_3f5cac8c49f6` at the tail. That EOA is the event's agent wallet.
**Alternatives:** Ask Altana to write a Schema 2 role tag in its relay (the documented model, but outside our control before the deadline); rely on Altana's relay and hope inner tags are credited (unverified).
**Consequences:** The agent EOA pays gas in CELO. Still to verify: that the SDK returns a signed intent without sending it, and how the intent's relay-payment fields behave when we submit it (M0 self-relay spike).
**Evidence:** Orchestrator source verified on Celo Blockscout (`execute(bytes)` is public, with no caller check); internal/research/raw/attribution-indexers-2026-11-21.md.

## D-004 · One ERC-8004 identity: Albashi's agent EOA, not each customer wallet · 2026-11-21 · accepted
**Context:** `register()` makes `msg.sender` the identity's owner and wallet. Altana registers an identity for every new wallet by default (`agentIdentity`, on by default).
**Decision:** Register Albashi's identity once, from the agent EOA. Create customer wallets with `agentIdentity: false`. Ask owners and freelancers to rate the agent in the Reputation Registry after a pay run.
**Alternatives:** An identity per customer wallet (scatters reputation and activity across many agents).
**Consequences:** One place for all reputation; the registration file lists Albashi's endpoints.
**Evidence:** docs.celo.org/build/agents/8004 (read 2026-11-21); `@altananetwork/sdk` 1.1.0 `client.d.ts` (`CreateClientOptions.agentIdentity`).

## D-005 · Sprint profile; spike kept in the repo, minus personal helpers · 2026-11-21 · accepted
**Context:** One builder. The spike's code was written during the build window and is the evidence for D-001..D-003.
**Decision:** Sprint profile: work items live in docs/PLAN.md, small commits land on main. `spike/` is committed, except `.env` (keys) and the helpers that name the owner's personal wallet (`bal.mjs`, `total.mjs`, `refund.mjs`, `evidence/refund.log`), which stay local.
**Consequences:** Spike files were checked for the three spike private keys before the first commit: none present.

## D-006 · Self-relay confirmed on mainnet; owner actions stay on Altana's relay for now · 2026-11-21 · accepted · confirms D-003
**Context:** D-003 depended on an untested recipe.
**Decision:** Albashi's agent self-relays every payout intent (E-005: tag at the tail, `verifyTx` reads it, sent from the agent EOA). The owner's one-off actions (create wallet, grant, revoke) keep going through Altana's relay for now, untagged; revisit if the organizers count owner-side transactions.
**Consequences:** The agent EOA needs a little CELO for gas (~0.08 CELO per payout intent). Each intent still pays Altana's quoted relay fee from the owner wallet (~0.32 CELO ≈ $0.02), on top of our gas. The product code must re-implement the hold-and-submit step cleanly (not a `fetch` interception) and must always simulate first (`execute` returns an error code instead of reverting).
**Evidence:** E-005, E-006, E-007.

## D-007 · The proof page is a lock screen of real credit alerts · 2026-11-22 · accepted
**Context:** The category's interfaces are a dashboard with a stats row or a stamped paper slip (the bar is in `internal/design/bar/`). Albashi needed a first screen that proves the claim, not one that describes it.
**Decision:** The public page is the lock screen a payment lands on: Lagos at dusk, the live Textile USD₮→₦ rate at clock scale with its read time, and frosted SMS-style alerts from sender ALBASHI. Each alert is a real Celo mainnet record linked to its proof; the refusal is shown as DEBIT DECLINED. Approved comp `.impeccable/mocks/comp-2.png` (user); first viewport accepted after an independent reviewer's ACCEPT. Type: Inter (rate, prose) and IBM Plex Mono (alerts), both carrying ₦ and ₮. Mark: the signature "a" ending in a gold dot. Alert glass was darkened from the comp for legibility (alert text 5.2:1 or better on a phone).
**Consequences:** No value on the page is illustrative: the alerts are E-002, E-003, E-005 and E-007, the rate is Textile's live preview (held up to 30 s, with its true read time). The top alert states the thesis as a goal ("WILL ONLY PAY") until C-1 is proven on mainnet. A layout change to the first screen needs the comp review again.
**Evidence:** https://albashi.vercel.app (deployed 2026-11-22); the hackathon UI audit passes all 26 checks there (2026-11-22).
