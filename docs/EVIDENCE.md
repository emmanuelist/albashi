# Evidence
Every public claim, and the proof behind it. Proofs are append-only. Claims are re-checked
against live state before anything is published.

## Claims
| # | Claim (verbatim) | Appears in | Proof | Status | Checked |
|---|---|---|---|---|---|
| C-1 | Albashi pays your freelancers in naira, and its agent can only pay the payslip you signed. | AGENTS.md; README (labelled "What we're building", not as a fact); GitHub repo description | none yet: needs the pay-run contract (D-002) and a mainnet refusal | unverified | 2026-11-21 |
| C-2 | An agent acting from an Altana wallet on Celo mainnet, under a session key, converted USD₮ to cNGN on Textile FX and paid another wallet. | README proof table (rows E-002, E-003) | E-002, E-003 | verified | 2026-11-21 |
| C-3 | The owner revoked the agent's session in one transaction, and the agent's next action was refused. | README proof table (E-004) | E-004 | verified | 2026-11-21 |
| C-4 | The agent can't move more USD₮ than its cap. | README proof table (E-007, worded as "was refused") | E-007: an over-cap USD₮ transfer was refused (`spend_limit_exceeded`) while the CELO fee cap had ample room, so the USD₮ cap was the binding limit | verified (by elimination; the SDK's message always names the fee token) | 2026-11-21 |
| C-5 | Every Albashi transaction carries our attribution tag. | not published yet | E-005: a self-relayed agent tx ends with `celo_3f5cac8c49f6` (`verifyTx` reads it). The owner's grant and revoke still go through Altana's relay, untagged | qualified: "every payout the agent sends" until owner actions are self-relayed too | 2026-11-21 |
| C-6 | Albashi's agent submits customers' Altana session intents itself, from one agent wallet, so each payout is tagged for attribution. | README proof table + "Why self-relay"; `spike/verify.mjs` re-checks it read-only | E-005 | verified | 2026-11-21 |

## Proofs
All on Celo mainnet (chain 42220). Raw transaction + receipt JSON is saved in `docs/evidence/` next to each link.

| # | Date | Claim | Proof | Commit |
|---|---|---|---|---|
| E-001 | 2026-11-21 | Owner granted a session: allowlist USD₮ / cNGN / Textile reactor, 2 USD₮ per day, 1 h expiry | [celoscan](https://celoscan.io/tx/0x26effe048111c592a476d9904b7b9192c08de75b6d1b485998981a0d44d6e6de) · `docs/evidence/E-001-0x26effe….json` | foundation |
| E-002 | 2026-11-21 | The agent swapped 1 USD₮ → 1,441.117203 cNGN on Textile from the Altana wallet, via its session key | [celoscan](https://celoscan.io/tx/0x2226464a8499c60bbf80bb96e8f8432b938f976f84ca2148fbed4b8cb059f95d) · `docs/evidence/E-002-0x222646….json` | foundation |
| E-003 | 2026-11-21 | The agent paid 1,441.117203 cNGN to a second wallet | [celoscan](https://celoscan.io/tx/0x37c107dbe9efcfa20ffe56d179045c2ac29dae9cd16d16f094bcf3c4355513db) · `docs/evidence/E-003-0x37c107….json` | foundation |
| E-004 | 2026-11-21 | Owner revoked the session in one tx; the agent's next execute was refused ("key hash … is unknown"); a call outside the allowlist was refused (`call_not_permitted`) | [celoscan](https://celoscan.io/tx/0xe43b71c664d21366a2f832d5fed97b4a0293055cc7558e66ef24565685453e08) · `docs/evidence/E-004-0xe43b71….json` · refusals in `docs/evidence/spike-run-2026-11-21T16-33Z.json` | foundation |

| E-005 | 2026-11-21 | **Self-relay:** the agent's own EOA (`0x9Fb5…dc79`) submitted an Altana session intent to the Orchestrator; it swapped 1 USD₮ → 1,440.569022 cNGN into the owner's Altana wallet; the calldata ends with `celo_3f5cac8c49f6` and `verifyTx` returns it | [celoscan](https://celoscan.io/tx/0x6272cb58f29012a94b6ed19a486c24f3e4887ca4ad2418c296d4500e4d0130c5) · `docs/evidence/E-005-0x6272cb….json` (logs: cNGN Transfer maker → owner 1,440,569,022; USD₮ owner → maker 999,801 + 199 fee) | selfrelay |
| E-006 | 2026-11-21 | Second session on a fresh wallet: grant (USD₮ cap 2/day, CELO fee cap 5/day) and one-tx revoke | [grant](https://celoscan.io/tx/0xb021c98e1e15892c7d864c42f0cf67710379015113192bbbadb7c9ba5dfb1b4e) · [revoke](https://celoscan.io/tx/0xc4acb8a8f3e149c51fc4ed4a3314a2f4b2f388e6f665fc33cddcf60b14b9763f) · `docs/evidence/selfrelay-run-2026-11-21T20-07Z.json` | selfrelay |
| E-007 | 2026-11-21 | Refusals in the same run: 1.5 USD₮ over the 2 USD₮/day cap → `spend_limit_exceeded` (CELO fee cap 5/day, ~0.32 used); after revoke, the agent's next intent → "key hash … is unknown", nothing prepared or sent | `docs/evidence/selfrelay-run-2026-11-21T20-07Z.json` | selfrelay |

### E-005..E-007 run
`spike/selfrelay.mjs --live`, 2026-11-21 20:07 UTC. The SDK's `execute` prepared and signed the swap intent through Altana's relay; its final `wallet_sendPreparedCalls` was held locally. The Intent was rebuilt from `context.quote.quotes[0].intent` with the session signature wrapped by `Key.wrapSignature`, simulated against the Orchestrator (returned `0x00000000`), then sent from the agent EOA with the tag appended. Gas paid by the agent: ~0.08 CELO. The intent still paid Altana's relay its quoted fee (0.3176 CELO) from the owner wallet.
The script read the owner's balance right after the swap and saw the old value (forno `latest` lag), so it skipped the payout step; the cNGN was confirmed by the final balance read and the tx logs. The leftovers went back to the owner's own wallet (untagged).

### E-001..E-004 run
`spike/spike.mjs --live`, 2026-11-21 16:33 UTC. Full step log: `docs/evidence/spike-run-2026-11-21T16-33Z.json`.
Textile accepted the owner key's EIP-712 TakerControl proof and rejected the session key's ERC-1271 proof (`proof_of_control_invalid`).
The tag `spike_altana_test` was found inside the calldata of E-002 and E-003, but not at the tail of the outer transaction (`verifyTx` → null).
