# Albashi — build rules and pinned context

Albashi pays your freelancers in naira, and its agent can only pay the payslip you signed.

**Read `docs/STATE.md` first.** It is the current truth: what works, what's deployed, what's next.
Research and strategy live in `internal/` (gitignored). Verified facts about every dependency
are in `docs/CONTEXT.md`. Read it before touching an integration.

## What Albashi is

A payroll agent for small agencies on Celo mainnet. The owner signs a payslip (who gets paid,
how much, and the lowest naira rate they accept). The agent converts USD₮ to cNGN on Textile FX
and pays each person on it. It acts only from the owner's Altana wallet, under a session key
whose allowlist reaches only the pay-run contract and Textile, inside a cap and an expiry, and
the owner can revoke it in one transaction.

## Repo layout

```
contracts/   Foundry: the pay-run contract that pays only a signed payslip   [M1]
apps/web     the owner's app: payslip, signing, live pay run                 [M1]
apps/agent   the agent: Textile quotes, Altana session, self-relay           [M1]
spike/       the 21 Nov mainnet spike (evidence for D-001..D-004); not product code
docs/        STATE, PLAN, DECISIONS, EVIDENCE, CONTEXT (see "Where things live")
internal/    research dossier and strategy (gitignored, never commit)
```

Folders marked [M1] don't exist yet; create each one in the phase that needs it.

## Pinned versions

Looked up on 2026-11-21, never from memory. Re-check before any upgrade.

| | Pinned |
|---|---|
| Node | 26 LTS (26.13.1). Node 20 and older are end-of-life and must never appear |
| Foundry | forge 1.8.3 |
| `@altananetwork/sdk` | 1.2.0 in apps/ (bundles porto 0.2.37; checked 2026-11-28). `spike/` stays on 1.1.0, the code behind E-001..E-007 |
| `viem` | 2.57.20 (2.58.4 was hours old on 2026-11-21; don't take a release under ~2 days old) |
| `@celo/attribution-tags` | 0.7.0 in apps/ (reads relayed intents; checked 2026-11-28). `spike/` stays on 0.5.0 |
| Next.js / React / TypeScript | decide when `apps/web` starts. TypeScript 7.0.2 shipped 2026-11-21: check typescript-eslint's peer range before pinning a major |

```bash
npm view <pkg> version time.modified   # current release and its date
npm view <tool> peerDependencies        # which versions a tool actually accepts
```

## Rules

1. **No mocks, no fake data, no demo mode.** Every rendered value comes from a real source:
   the chain (Celo mainnet) for balances, pay runs and payments; Textile's API for quotes;
   Altana's Keystore for session state. If a source is down, say so on screen; never fill in.
2. **Verify every SDK and contract call before writing it.** TypeScript: the installed types
   (`node_modules/<pkg>/**/*.d.ts`). Contracts: the verified source or ABI on Celo's explorer.
   HTTP APIs (Textile): the current API reference. If a call can't be verified, stop and say so.
3. **Phase-gated.** Build the current milestone only, then stop for confirmation. Milestones and
   their exit criteria are in `docs/PLAN.md`; the current one is in `docs/STATE.md`.
4. **Every transaction carries the attribution tag `celo_3f5cac8c49f6`**, at the very end of the
   *outer* transaction's calldata. Attach it where the wallet client is built, not per call.
   After the first transaction of any new code path, check it with `verifyTx`. An untagged
   transaction can never be credited. Internal transfers (moving our own money) stay untagged.
5. **Money is `bigint` in token base units end to end** (USD₮ and cNGN are 6 decimals). Never a
   float on-chain, never a rounded display value fed back into a transaction.
6. **No language model decides a payment.** Amounts, recipients and the rate floor come from the
   payslip the owner signed; models may only draft text.
7. **Every write persists, and the response returns the persisted state** (a confirmed receipt,
   a re-read balance), never an object built in memory.
8. **Tests cover failure paths**: a recipient not on the payslip, an amount over it, a rate below
   the floor, an expired or revoked session, a `no_quote` from Textile.
9. **No secrets in the repo.** Keys only in `.env` files; blank-valued keys in `.env.example`.
10. **Never cut scope silently.** Cuts are the user's decision. Present the tradeoff on technical
    merit, and record an accepted cut in `docs/DECISIONS.md`.

## Frontend

- **`DESIGN-RULES.md` is the authority for every interface** (layout, type, spacing, colour, touch,
  states), above any skill or tool, impeccable included. Build mobile-first at 375 px, and screenshot
  375 and 1440 before committing a UI change. A deliberate exception is recorded in `docs/DECISIONS.md`.
- The look lives in `DESIGN.md` and `apps/web/app/globals.css` (tokens). The desk's copy speaks payroll,
  not contract: names before addresses, naira first, chain detail one tap away.
- Run `node ~/.claude/skills/hackathon/scripts/ui-audit.mjs <url>` on the deployed pages before a
  milestone closes; every FAIL is a finding.

## Verification before any gate

All green before any milestone closes; CI runs the same commands on every push.

| Part | Gate |
|---|---|
| `contracts/` | `forge fmt --check` · `forge lint --deny warnings` · `forge build --sizes` · `forge test` |
| `apps/*` (npm) | `npm run lint` (zero warnings) · `npm run typecheck` · `npm test` · `npm run build` |
| whole repo | `gitleaks git` (no secret in any commit) |

## Where things live
| Concern | File |
|---|---|
| Current truth: what works, what's deployed, what's next | docs/STATE.md (read it first) |
| Time left and current phase | the clock line printed at session start (.claude/hooks/clock.mjs) |
| Milestones, the build window and its checkpoints | docs/PLAN.md |
| Work items | the checklist in docs/PLAN.md (sprint profile) |
| Why we chose what we chose | docs/DECISIONS.md (append-only) |
| Proof that things work, and every public claim it backs | docs/EVIDENCE.md (raw captures in docs/evidence/) |
| Demo script, video script, submission draft | docs/RUNOFSHOW.md, docs/VIDEO.md, internal/SUBMISSION.md |
| Verified facts about dependencies, and traps | docs/CONTEXT.md. Read it before touching any integration. |
| Research, strategy | internal/ (gitignored) |

## Operating protocol
- **Start:** read docs/STATE.md and the clock line, then the open work items for the current milestone and the last 3 entries of docs/DECISIONS.md. Say the next action back before starting.
- **Work:** one item at a time. A small commit to main that passes the gate, with the evidence in the message.
- **Commit messages are public from the first commit.** Say what changed and why, plainly. No competitor names or strategy, no remarks about judges, sponsors or other teams, no keys or private URLs, no claim the claims table hasn't verified.
- **Parallel agents** only on independent items with their own acceptance criteria, each in its own git worktree, each merged only when its gate is green. Never two agents on the demo path at once.
- **Before publishing** a post, README change, submission or video: every factual sentence in it has a `verified` row in the claims table in docs/EVIDENCE.md, re-checked against live state today.
- **Finish** (or `/foundation handoff`): append EVIDENCE and DECISIONS, update CONTEXT and the claims table, tick work items with evidence, rewrite docs/STATE.md, commit.
- **Truth rule:** never write a claim into STATE, README or a commit that wasn't verified this session. Write "unverified" instead.
- **Decisions:** never relitigate an accepted decision without new evidence; supersede it with a new entry.
