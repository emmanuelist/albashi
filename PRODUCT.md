# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js on Vercel (chosen 2026-11-21). Server-rendered so the thesis and the last on-chain state reach judges, crawlers and link previews without JavaScript. Chain access through viem, `@altananetwork/sdk` and `@celo/attribution-tags` (versions pinned in AGENTS.md).

## Users

- **Agency owners in Nigeria** (primary): small agencies and studios paid by clients in US dollars, paying a team of freelancers in naira. They pay many people per run and care about two things: the naira rate they get, and that nobody is paid the wrong amount or the wrong person. They work on a phone and a laptop equally: phone to check and approve, laptop to set things up.
- **Freelancers** (recipients): receive naira (cNGN) on Celo and need to recognise and trust the payment.
- **Hackathon judges** (evaluators, until 7 Dec 2026): see the public page for minutes, often on a phone, and check claims against the chain.

## Product Purpose

Albashi is a payroll agent on Celo. The owner signs a payslip: who gets paid, how much, and the lowest naira rate they accept. The agent converts USD₮ to cNGN at a firm Textile FX quote and pays each person on it, acting from the owner's own Altana wallet. Success: a real agency's real pay run, every person paid exactly what was signed, at a rate at or above the signed floor, with nothing the owner didn't approve.

## Positioning

"Albashi pays your freelancers in naira, and its agent can only pay the payslip you signed." Albashi (Hausa: salary). The difference is the limit: the agent acts under a session key the owner grants (contracts it may call, a spend cap, an expiry) and can revoke in one transaction, and a pay-run contract pays only the signed lines and refuses anything else. Payroll tools that hold your money, or agents that hold your keys, can't make that claim.

## Operating Context

- Money flow: client pays the agency in USD₮ → owner's Altana wallet on Celo → Textile FX RFQ swap USD₮→cNGN → each freelancer's wallet.
- Every agent transaction carries the attribution code `celo_3f5cac8c49f6` and is self-relayed by Albashi's agent wallet (docs/DECISIONS.md D-003, D-006).
- Familiar artefacts in this world: payslips and pay-advice slips, payroll registers, bank transfer receipts shared on WhatsApp, the bureau-de-change rate board, cheque counterfoils.

## Capabilities and Constraints

- Proven on Celo mainnet: Altana session grant with allowlist, caps and expiry; USD₮→cNGN swap from the owner's wallet; cNGN payout; one-transaction revoke; refusal of off-allowlist and over-cap actions; self-relay with the tag at the tail (docs/EVIDENCE.md E-001..E-007).
- Not built yet: the pay-run contract, the owner app, ERC-8004 registration.
- Textile quotes expire in about 60 seconds and can come back `no_quote`; the owner signs a proof of wallet control about once per 12 hours.
- Amounts are cNGN and USD₮, 6 decimals each; naira is the unit people read.
- Open: how recipients cash cNGN out to naira (to confirm with a real freelancer); the named agency.

## Brand Commitments

- Name: Albashi. Thesis sentence used verbatim on every surface.
- Voice: plain, exact, never hype. Every number says where it came from.
- No mock data, no demo mode: every value shown comes from the chain, Textile or Altana (AGENTS.md rule 1).

## Evidence on Hand

- Mainnet transactions and raw captures: docs/evidence/ (E-001..E-007).
- `spike/verify.mjs`: read-only check of the self-relayed transaction.
- None yet: customer names, testimonials, pay-run volume, screenshots of an app. Do not invent any of them.

## Product Principles

1. **The owner's signature is the authority.** Nothing pays out that the owner didn't sign; the interface makes the signed payslip the object everything else is checked against.
2. **Show the limit, not just the payment.** Cap, allowlist, expiry and revoke are part of the product, visible where the money moves.
3. **Every value says where it came from**, and links to check it.
4. **Naira first.** People read ₦; USD₮ and cNGN are the rails.
5. **Refusals are features.** A payment that was refused is shown and explained, not hidden.

## Accessibility & Inclusion

Phone-first legibility on mid-range Android screens and patchy mobile data in Nigeria; no information carried by colour alone; numbers readable at a glance (tabular figures).
