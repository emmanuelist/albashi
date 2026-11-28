# Albashi

[![ci](https://github.com/emmanuelist/albashi/actions/workflows/ci.yml/badge.svg)](https://github.com/emmanuelist/albashi/actions/workflows/ci.yml)
· Celo mainnet · built for [Agents Open for Business](https://www.loops.house/agents-open-for-business) (Stablecoin Corridors · Altana Agent Wallets)

**Albashi pays your freelancers in naira, and its agent can only pay the payslip you signed.** Live at [albashi.vercel.app](https://albashi.vercel.app): the owner's desk is [/desk](https://albashi.vercel.app/desk), and a real freelancer's receipt is [here](https://albashi.vercel.app/receipt/0xfe750155a452f2ee358a6983165e9f5b544b59ba0c8baeb4a888f3637b0c9889/1). The limits are [below](#limits).

*Albashi* is Hausa for salary. A small agency is paid by its clients in dollars and pays its people in naira. Albashi's agent does the payroll on Celo. It converts USD₮ to cNGN at a firm Textile FX quote and pays each person, acting from the owner's own Altana wallet under a session key the owner can revoke in one transaction. The hard part is the limit. A session key can be scoped to *contracts*, not *recipients*, so an agent allowed to move cNGN could pay anyone within its cap. Albashi's answer is a pay-run contract: the owner signs the payslip (who, how much, the lowest rate they'll accept), the agent's session may call only that contract, and the contract fills the Textile quote itself, checks the rate, and pays only what was signed.

**Status, 28 Nov 2026:** three pay runs on Celo mainnet from the Albashi team's own agency wallet, the latest paying a real freelancer, ₦1,500 to a photographer in Lagos (E-018). The owner writes, signs and runs payslips on the [desk](https://albashi.vercel.app/desk), and stopped the agent from it in one transaction (E-019). Albashi's agent is ERC-8004 agent 10095. Plan: [docs/PLAN.md](docs/PLAN.md) · state: [docs/STATE.md](docs/STATE.md).

## Track requirements, each with its proof

| Requirement (verbatim) | Proof on Celo mainnet |
|---|---|
| Stablecoin Corridors: *At least one tagged Textile FX conversion on Celo mainnet in a listed corridor, used in the product flow* | Every pay run fills a Textile FX quote USD₮→cNGN with the pay-run contract as the taker, tagged `celo_3f5cac8c49f6`: [0xfe75…9889](https://celoscan.io/tx/0xfe750155a452f2ee358a6983165e9f5b544b59ba0c8baeb4a888f3637b0c9889) (E-018), [0x7b5e…1b94](https://celoscan.io/tx/0x7b5e0bb86b691472947a463461e92d0235c74256eaac8ae7d1b0e42af3251b94) (E-016), [0xaaab…9bfc](https://celoscan.io/tx/0xaaabd2dfa98b955f8e5edb3b9eabe1b7b0d750d4983bdb3152a30f5815b89bfc) (E-010) |
| Stablecoin Corridors: *Payments in a local stablecoin reach a recipient outside the team* | ₦1,500 cNGN to Tommy Braz, a photographer in Lagos, `0xFF81…8D79`: [0xfe75…9889](https://celoscan.io/tx/0xfe750155a452f2ee358a6983165e9f5b544b59ba0c8baeb4a888f3637b0c9889), [his receipt](https://albashi.vercel.app/receipt/0xfe750155a452f2ee358a6983165e9f5b544b59ba0c8baeb4a888f3637b0c9889/1) (E-018) |
| Altana: *Agent acts from an Altana wallet on Celo mainnet* | The agent `0x1Bce…8ce8` submits the owner's session intents to Altana's Orchestrator, acting as the owner's Altana wallet `0x0Eca…D4B1` (E-018) |
| Altana: *At least one session key with a spend cap, contract allowlist, or expiry, shown in the demo* | The session may call only the pay-run contract's `run`, until 21 Jan 2027, with a 3 CELO/day fee cap: read live on the [desk](https://albashi.vercel.app/desk) under "What the agent can do" (E-015, E-019) |
| Altana: *The demo shows a revoke transaction and the agent being stopped* | The owner pressed Stop the agent on the desk: [0x0fd2…6341](https://celoscan.io/tx/0x0fd2eb83f29afa64940df3cbf08af305fc89d49d100ecb9672251b50d8256341); the agent's next call was refused by Altana's relay ("key hash … is unknown"), then its permission was given back (E-019; [before/after checks](docs/evidence/)) |
| Both: *ERC-8004 identity* | Agent 10095, owned by the agent wallet: [registration](https://celoscan.io/tx/0x025485429c8ddd3d78f4bc117f349ac935209868fb7f59455c8086ea8d179318), [agent file](https://albashi.vercel.app/.well-known/agent-registration.json) (E-013) |

## Proof: what already works on Celo mainnet

Every row links to the transaction, and a raw copy of each transaction and its receipt is saved in [docs/evidence/](docs/evidence/).

| What happened | Transaction | Evidence |
|---|---|---|
| **A real freelancer paid.** On the desk the owner signed one line, ₦1,500 to Tommy Braz (photographer); the agent ran it and the pay-run contract paid exactly that line, 1.041256 USD₮ at ₦1,440.57 per USD₮ (signed floor ₦1,426.15). Signed by the owner's key in a recorded browser | [0xfe75…9889](https://celoscan.io/tx/0xfe750155a452f2ee358a6983165e9f5b544b59ba0c8baeb4a888f3637b0c9889) | E-018 |
| **The owner stopped the agent** from the desk in one transaction; the agent's next call was refused, then its permission was given back and the fee cap restored | [revoke](https://celoscan.io/tx/0x0fd2eb83f29afa64940df3cbf08af305fc89d49d100ecb9672251b50d8256341) · [re-grant](https://celoscan.io/tx/0xb05ba9ef59954dc298de15b664cb96246826ba48f44e5ce0c378440c229458d8) | E-019 |
| **A pay run signed in MetaMask** on the deployed desk: ₦750 and ₦800 to two test wallets, exactly as signed | [0x7b5e…1b94](https://celoscan.io/tx/0x7b5e0bb86b691472947a463461e92d0235c74256eaac8ae7d1b0e42af3251b94) | E-016 |
| **The first pay run.** The owner signed a payslip: ₦700 and ₦800 to two wallets, at most 1.5 USD₮, at least ₦1,427.85 per USD₮. The agent sent it through its session, tagged. The pay-run contract filled a Textile FX quote as the taker (1.040028 USD₮ → ₦1,500, i.e. ₦1,442.27 per USD₮) and paid exactly the two signed lines | [0xaaab…9bfc](https://celoscan.io/tx/0xaaabd2dfa98b955f8e5edb3b9eabe1b7b0d750d4983bdb3152a30f5815b89bfc) | E-010 |
| **The refusal.** The same signature on that payslip plus one payee the owner never signed: the pay-run contract refused it (`NotSigned`), and Altana's relay would not sign the intent, so nothing was sent | (refused before sending; [run log](docs/evidence/proof-run-2026-11-22T07-32-07-970Z.json)) | E-011 |
| The agent deployed the pay-run contract, tagged: [`0xfa8d…59Af`](https://celoscan.io/address/0xfa8d963525d5F28427B897A0C761C744A43e59Af), source [verified on Sourcify](https://repo.sourcify.dev/42220/0xfa8d963525d5F28427B897A0C761C744A43e59Af) | [0xdd89…e040](https://celoscan.io/tx/0xdd89af91bb759511f1e1dcbd87f2187428e801220ff24352844d679bc2d9e040) | E-008 |
| The owner deposited a 1.5 USD₮ float into it from its own key, tagged, and granted the agent a session whose only call is the pay-run contract's `run` | [deposit](https://celoscan.io/tx/0x42ae21fe0bbc8650067fd95c6f76693dad1b5f6cbeb7eb6848a0aa1dfb979628) · [grant](https://celoscan.io/tx/0x9d0edbbcab1024890e2898f89e35615a5971a99234d602e878a6f86ac0af1335) | E-009 |
| The agent registered its ERC-8004 identity (agent 10095), tagged; registration file at [/.well-known/agent-registration.json](https://albashi.vercel.app/.well-known/agent-registration.json) | [0x0254…9318](https://celoscan.io/tx/0x025485429c8ddd3d78f4bc117f349ac935209868fb7f59455c8086ea8d179318) | E-013 |
| An agent acting from an Altana wallet, under a session key, swapped 1 USD₮ for 1,441.12 cNGN on Textile FX | [0x2226…f95d](https://celoscan.io/tx/0x2226464a8499c60bbf80bb96e8f8432b938f976f84ca2148fbed4b8cb059f95d) | E-002 |
| The agent paid that cNGN to another wallet | [0x37c1…13db](https://celoscan.io/tx/0x37c107dbe9efcfa20ffe56d179045c2ac29dae9cd16d16f094bcf3c4355513db) | E-003 |
| Spike (21 Nov, an earlier wallet): the owner revoked the session in one transaction, and the agent's next action was refused. A call outside the session's allowlist was refused too | [0xe43b…3e08](https://celoscan.io/tx/0xe43b71c664d21366a2f832d5fed97b4a0293055cc7558e66ef24565685453e08) | E-004 |
| **Self-relay:** the agent's own wallet submitted the session-signed intent to the Orchestrator, with our attribution code `celo_3f5cac8c49f6` at the end of the calldata. 1 USD₮ became 1,440.57 cNGN in the owner's wallet | [0x6272…30c5](https://celoscan.io/tx/0x6272cb58f29012a94b6ed19a486c24f3e4887ca4ad2418c296d4500e4d0130c5) | E-005 |
| A USD₮ transfer over the session's 2 USD₮ daily cap was refused | (refused before sending) | E-007 |

Why self-relay: Altana's relay submits a session's actions itself, so an app's attribution tag ends up inside the calldata instead of at its end, where Celo's attribution indexer reads it ([INDEXERS.md](https://github.com/celo-org/attribution-tags/blob/main/INDEXERS.md)). The Orchestrator's `execute(bytes)` accepts any caller, so Albashi's agent submits the intent itself and the tag stays at the end (E-005). The session's limits are still enforced by the wallet contract, not by Albashi. The decision and its tradeoffs are in [docs/DECISIONS.md](docs/DECISIONS.md) (D-003, D-006).

## Verify without trusting this README

Read-only, no wallet, no keys. It checks E-018 and E-019 directly on Celo:

```bash
git clone https://github.com/emmanuelist/albashi && cd albashi/spike
npm ci
node verify.mjs
```

```text
PASS  E-018 sent by the agent wallet on file  (0x1bce3f6267983dfab58ced6261ef05a28e168ce8)
PASS  E-018 sent to Altana's Orchestrator, acting as the owner's wallet  (0xaf140d0416a994aebb3fa6212b16ce6700f09751)
PASS  E-018 mined successfully  (block 83967858)
PASS  E-018 attribution tag celo_3f5cac8c49f6 at the end of the calldata  ({"codes":["celo_3f5cac8c49f6"],"schemaId":0})
PASS  E-018 the pay-run contract paid the freelancer ₦1,500 in cNGN  (1500 cNGN to 0xFF8175D609814fb3a9A2e0Bc10D5ac8e36f48D79)
PASS  E-019 the owner's wallet called revoke on itself  (0xb75c7dc6 from 0x0ecaafc1bd6f7033d6eb038d8cbc8a55f900d4b1)
PASS  E-019 mined successfully  (block 83969709)
PASS  E-019 the agent's key was gone right after the revoke  (getKey at block 83969709: gone)
```

## How a pay run works

```text
owner ── deposits a USD₮ float that only its signed payslips can spend ──► pay-run contract
owner ── signs payslip (recipients, amounts, USD₮ budget, minimum cNGN per USD₮, deadline)
owner ── grants a session: may call only the pay-run contract's run, expiring ──► Altana wallet
agent ── Textile RFQ: firm USD₮→cNGN quote, the pay-run contract as the taker
agent ── run(payslip, signature, quote): swap, rate check, pay each signed line ──► freelancers' wallets
agent ── submits every intent itself, attribution tag at the tail ──► Celo mainnet
owner ── one transaction revokes the session ──► the agent is stopped
```

| Piece | What it is | State |
|---|---|---|
| Textile FX | RFQ conversion USD₮ ↔ cNGN on Celo | in every pay run (E-010, E-016, E-018) |
| Altana wallet | non-custodial wallet; session keys with call allowlist, spend caps, expiry, one-transaction revoke | used on mainnet (E-001, E-004, E-015, E-019) |
| Self-relay | agent EOA submits session intents to the Orchestrator | in product code, used by the pay run (E-005, E-010) |
| Pay-run contract | pays only a signed payslip, at or above the signed rate, from the owner's float | live on mainnet (E-008, E-010, E-011); not audited |
| Owner desk | payslip, signing, live pay run, stop the agent, receipts | live at [/desk](https://albashi.vercel.app/desk) (E-016, E-018, E-019) |
| ERC-8004 identity | one identity for Albashi's agent | agent 10095 (E-013) |

## Limits

- Three pay runs so far, all from the Albashi team's own agency wallet: two to its own test wallets (E-010, E-016) and ₦1,500 to its first real freelancer, a photographer in Lagos (E-018, [receipt](https://albashi.vercel.app/receipt/0xfe750155a452f2ee358a6983165e9f5b544b59ba0c8baeb4a888f3637b0c9889/1)). No other agency has run payroll yet, and cashing cNGN out to a bank is still being checked with him.
- The refusal of an unsigned payee was checked against mainnet state by the pay-run contract and by Altana's relay, which would not sign it. No failed transaction was mined.
- The session grant goes through Altana's relay, so it is untagged. Every transaction Albashi sends itself carries the tag.
- Altana's wallet code (Porto) gives every session key a standing permission on its Orchestrator, used for relay fees. We haven't audited it.
- One run's relay fee (0.667 CELO) uses most of the SDK's default 1 CELO/day fee cap, so a real agency's session needs a wider one.
- Whether freelancers can cash cNGN out to naira easily is still being checked with a real user.
- No audit.

## Build and test from a clean clone

The contracts' libraries (forge-std, OpenZeppelin) are git submodules, so clone with `--recurse-submodules`, or run `git submodule update --init --recursive` in a clone you already have. A plain `git clone` leaves `contracts/lib/` empty and `forge build` can't find its imports.

```bash
git clone --recurse-submodules https://github.com/emmanuelist/albashi && cd albashi/contracts
forge build && forge test     # Foundry 1.8.x; 33 tests, no network needed
```

## Repo

| Path | What |
|---|---|
| [contracts/](contracts/) | the pay-run contract (Foundry): `src/PayRun.sol`, 33 tests incl. failure paths and a fuzzed rate floor |
| [apps/agent/](apps/agent/) | the agent: Textile quotes, self-relay, session setup, `scripts/proof-run.ts` (the live run) |
| [apps/web/](apps/web/) | the proof page, the owner desk and freelancer receipts at [albashi.vercel.app](https://albashi.vercel.app) |
| [spike/](spike/) | the mainnet spikes: `spike.mjs` (session, swap, payout, revoke), `selfrelay.mjs` (self-relay), `verify.mjs` (read-only check of E-018 and E-019) |
| [docs/](docs/) | [STATE](docs/STATE.md) · [PLAN](docs/PLAN.md) · [DECISIONS](docs/DECISIONS.md) · [EVIDENCE](docs/EVIDENCE.md) (claims and proofs) · [CONTEXT](docs/CONTEXT.md) (verified addresses, SDK calls, traps) |
| [AGENTS.md](AGENTS.md) | build rules for anyone, human or agent, working on this repo |

Running the live spikes spends real money on Celo mainnet (about 20 CELO for a session-key registration, plus a $1 swap). `verify.mjs` spends nothing.
