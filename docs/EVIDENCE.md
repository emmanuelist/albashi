# Evidence
Every public claim, and the proof behind it. Proofs are append-only. Claims are re-checked
against live state before anything is published.

## Claims
| # | Claim (verbatim) | Appears in | Proof | Status | Checked |
|---|---|---|---|---|---|
| C-1 | Albashi pays your freelancers in naira, and its agent can only pay the payslip you signed. | AGENTS.md (internal); later README h1, repo description, form, video close | none yet: needs the pay-run contract (D-002) and a mainnet refusal | unverified | 2026-11-21 |
| C-2 | An agent acting from an Altana wallet on Celo mainnet, under a session key, converted USD₮ to cNGN on Textile FX and paid another wallet. | not published yet | E-002, E-003 | verified | 2026-11-21 |
| C-3 | The owner revoked the agent's session in one transaction, and the agent's next action was refused. | not published yet | E-004 | verified | 2026-11-21 |
| C-4 | The agent can't move more USD₮ than its cap. | not published yet | refusal seen, but the error named the CELO fee cap | unverified | 2026-11-21 |
| C-5 | Every Albashi transaction carries our attribution tag. | not published yet | E-002/E-003 show it inside the calldata, not at the tail; D-003 | false today (fix: D-003) | 2026-11-21 |

## Proofs
All on Celo mainnet (chain 42220). Raw transaction + receipt JSON is saved in `docs/evidence/` next to each link.

| # | Date | Claim | Proof | Commit |
|---|---|---|---|---|
| E-001 | 2026-11-21 | Owner granted a session: allowlist USD₮ / cNGN / Textile reactor, 2 USD₮ per day, 1 h expiry | [celoscan](https://celoscan.io/tx/0x26effe048111c592a476d9904b7b9192c08de75b6d1b485998981a0d44d6e6de) · `docs/evidence/E-001-0x26effe….json` | foundation |
| E-002 | 2026-11-21 | The agent swapped 1 USD₮ → 1,441.117203 cNGN on Textile from the Altana wallet, via its session key | [celoscan](https://celoscan.io/tx/0x2226464a8499c60bbf80bb96e8f8432b938f976f84ca2148fbed4b8cb059f95d) · `docs/evidence/E-002-0x222646….json` | foundation |
| E-003 | 2026-11-21 | The agent paid 1,441.117203 cNGN to a second wallet | [celoscan](https://celoscan.io/tx/0x37c107dbe9efcfa20ffe56d179045c2ac29dae9cd16d16f094bcf3c4355513db) · `docs/evidence/E-003-0x37c107….json` | foundation |
| E-004 | 2026-11-21 | Owner revoked the session in one tx; the agent's next execute was refused ("key hash … is unknown"); a call outside the allowlist was refused (`call_not_permitted`) | [celoscan](https://celoscan.io/tx/0xe43b71c664d21366a2f832d5fed97b4a0293055cc7558e66ef24565685453e08) · `docs/evidence/E-004-0xe43b71….json` · refusals in `docs/evidence/spike-run-2026-11-21T16-33Z.json` | foundation |

### E-001..E-004 run
`spike/spike.mjs --live`, 2026-11-21 16:33 UTC. Full step log: `docs/evidence/spike-run-2026-11-21T16-33Z.json`.
Textile accepted the owner key's EIP-712 TakerControl proof and rejected the session key's ERC-1271 proof (`proof_of_control_invalid`).
The tag `spike_altana_test` was found inside the calldata of E-002 and E-003, but not at the tail of the outer transaction (`verifyTx` → null).
