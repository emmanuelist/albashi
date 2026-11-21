# Albashi

[![ci](https://github.com/emmanuelist/albashi/actions/workflows/ci.yml/badge.svg)](https://github.com/emmanuelist/albashi/actions/workflows/ci.yml)
· Celo mainnet · built for [Agents Open for Business](https://www.loops.house/agents-open-for-business) (Stablecoin Corridors · Altana Agent Wallets)

**What we're building:** Albashi pays your freelancers in naira, and its agent can only pay the payslip you signed.

*Albashi* is Hausa for salary. A small agency is paid by its clients in dollars and pays its people in naira. Albashi's agent does the payroll on Celo. It converts USD₮ to cNGN at a firm Textile FX quote and pays each person, acting from the owner's own Altana wallet under a session key the owner can revoke in one transaction. The hard part is the limit. A session key can be scoped to *contracts*, not *recipients*, so an agent allowed to move cNGN could pay anyone within its cap. Albashi's answer is a pay-run contract: the owner signs the payslip (who, how much, the lowest rate they'll accept), the agent's session may call only that contract and Textile, and the contract pays only what was signed.

**Status, 21 Nov 2026:** the mainnet spikes below are done. The pay-run contract and the app are not built yet. The plan and its dates are in [docs/PLAN.md](docs/PLAN.md), and the current state is in [docs/STATE.md](docs/STATE.md).

## Proof: what already works on Celo mainnet

Every row links to the transaction, and a raw copy of each transaction and its receipt is saved in [docs/evidence/](docs/evidence/).

| What happened | Transaction | Evidence |
|---|---|---|
| An agent acting from an Altana wallet, under a session key, swapped 1 USD₮ for 1,441.12 cNGN on Textile FX | [0x2226…f95d](https://celoscan.io/tx/0x2226464a8499c60bbf80bb96e8f8432b938f976f84ca2148fbed4b8cb059f95d) | E-002 |
| The agent paid that cNGN to another wallet | [0x37c1…13db](https://celoscan.io/tx/0x37c107dbe9efcfa20ffe56d179045c2ac29dae9cd16d16f094bcf3c4355513db) | E-003 |
| The owner revoked the session in one transaction, and the agent's next action was refused. A call outside the session's allowlist was refused too | [0xe43b…3e08](https://celoscan.io/tx/0xe43b71c664d21366a2f832d5fed97b4a0293055cc7558e66ef24565685453e08) | E-004 |
| **Self-relay:** the agent's own wallet submitted the session-signed intent to the Orchestrator, with our attribution code `celo_3f5cac8c49f6` at the end of the calldata. 1 USD₮ became 1,440.57 cNGN in the owner's wallet | [0x6272…30c5](https://celoscan.io/tx/0x6272cb58f29012a94b6ed19a486c24f3e4887ca4ad2418c296d4500e4d0130c5) | E-005 |
| A USD₮ transfer over the session's 2 USD₮ daily cap was refused | (refused before sending) | E-007 |

Why self-relay: Altana's relay submits a session's actions itself, so an app's attribution tag ends up inside the calldata instead of at its end, where Celo's attribution indexer reads it ([INDEXERS.md](https://github.com/celo-org/attribution-tags/blob/main/INDEXERS.md)). The Orchestrator's `execute(bytes)` accepts any caller, so Albashi's agent submits the intent itself and the tag stays at the end (E-005). The session's limits are still enforced by the wallet contract, not by Albashi. The decision and its tradeoffs are in [docs/DECISIONS.md](docs/DECISIONS.md) (D-003, D-006).

## Verify without trusting this README

Read-only, no wallet, no keys. It checks E-005 directly on Celo:

```bash
git clone https://github.com/emmanuelist/albashi && cd albashi/spike
npm ci
node verify.mjs
```

```text
PASS  sent by the agent EOA, not a relay  (0x9fb5a16af64eec7a640f2aa1c7c6ac6e89f0dc79)
PASS  sent to the Orchestrator  (0xaf140d0416a994aebb3fa6212b16ce6700f09751)
PASS  mined successfully  (block 83390906)
PASS  attribution tag celo_3f5cac8c49f6 at the end of the calldata  ({"codes":["celo_3f5cac8c49f6"],"schemaId":0})
PASS  cNGN arrived in the owner's Altana wallet  (1440.569022 cNGN)
```

## How a pay run will work

```text
owner ── signs payslip (recipients, amounts, minimum cNGN per USD₮) ──► pay-run contract
owner ── grants a session: may call only the pay-run contract + Textile, capped, expiring ──► Altana wallet
agent ── Textile RFQ: firm USD₮→cNGN quote for the run ──► swap, inside the session
agent ── pay-run contract pays each signed line, refuses anything else ──► freelancers' wallets
agent ── submits every intent itself, attribution tag at the tail ──► Celo mainnet
owner ── one transaction revokes the session ──► the agent is stopped
```

| Piece | What it is | State |
|---|---|---|
| Textile FX | RFQ conversion USD₮ ↔ cNGN on Celo | used on mainnet (E-002, E-005) |
| Altana wallet | non-custodial wallet; session keys with call allowlist, spend caps, expiry, one-transaction revoke | used on mainnet (E-001, E-004, E-006) |
| Self-relay | agent EOA submits session intents to the Orchestrator | proven on mainnet (E-005) |
| Pay-run contract | pays only a signed payslip, at or above the signed rate | not built |
| Owner app | payslip, signing, live pay run | not built |
| ERC-8004 identity | one identity for Albashi's agent | not registered yet |

## Limits

- Nothing on this page is the product yet. These are spikes, written during the build window (from 20 Nov 2026), proving the parts the product rests on.
- The thesis above is unproven until the pay-run contract refuses an off-payslip payment on mainnet.
- The spike's self-relay works by holding the Altana SDK's last relay request and submitting it ourselves. The product needs a cleaner version of that step.
- The owner's own setup transactions (create wallet, grant, revoke) still go through Altana's relay and are untagged.
- Textile accepts the owner key's proof of wallet control, not the session key's, so the owner signs once per pay run.
- Whether freelancers can cash cNGN out to naira easily is still being checked with a real user.
- No audit.

## Repo

| Path | What |
|---|---|
| [spike/](spike/) | the mainnet spikes: `spike.mjs` (session, swap, payout, revoke), `selfrelay.mjs` (self-relay), `verify.mjs` (read-only check) |
| [docs/](docs/) | [STATE](docs/STATE.md) · [PLAN](docs/PLAN.md) · [DECISIONS](docs/DECISIONS.md) · [EVIDENCE](docs/EVIDENCE.md) (claims and proofs) · [CONTEXT](docs/CONTEXT.md) (verified addresses, SDK calls, traps) |
| [AGENTS.md](AGENTS.md) | build rules for anyone, human or agent, working on this repo |

Running the live spikes spends real money on Celo mainnet (about 20 CELO for a session-key registration, plus a $1 swap). `verify.mjs` spends nothing.
