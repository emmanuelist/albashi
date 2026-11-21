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
