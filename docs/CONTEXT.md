# Context
Verified facts about everything Albashi depends on. Each entry says how it was verified, so no
session has to re-derive it or trust training data. Read before touching an integration.

## Platforms and environments
| Name | Kind | ID | Endpoint | Explorer | Verified |
|---|---|---|---|---|---|
| Celo mainnet | chain (OP-stack L2) | 42220 | `https://forno.celo.org` (`CELO_RPC_URL`) | celoscan.io · celo.blockscout.com | used for the spike, 2026-11-21 |
| Altana relay | intent relay | — | `https://relay.altana.network` (SDK `RELAY_URL`) | explorer.altana.network | spike, 2026-11-21 |
| Textile FX API | RFQ | — | `https://api.textilecredit.com/v2` | app.textilecredit.com | spike + live previews, 2026-11-21 |

## SDKs and APIs
| Package / API | Pinned | Calls we use (exact) | Verified in |
|---|---|---|---|
| `@altananetwork/sdk` | 1.1.0 | `createClient({ chains: [CELO], agentIdentity })`; `client.createWallet({ signer })`; `client.grantSession({ wallet, signer, permissions: { calls: [{ to }], spend: [{ limit, period, token }] }, expiry, sessionSigner, feeToken, chainId })`; `client.execute({ session, calls: [{ to, data, value }], feeToken, chainId })`; `client.revokeSession({ wallet, signer, session, feeToken })`; `client.quoteGrantSession(…)`; `client.feeCurrencies({ chainId })`; `signerFromPrivateKey(hex)`; `serializeSession(session)` / `deserializeSession(stored, signer)`; `signOrderTypedData(session, typedData)` | `node_modules/@altananetwork/sdk/dist/{client,execute,internal/sessions,signOrder}.d.ts` |
| `@celo/attribution-tags` | 0.5.0 | `toDataSuffix(code \| codes[])` (codes match `/^[a-z0-9_]{1,32}$/`); `verifyTx({ client, hash })`; `fromDataSuffix(data)`; `withAttribution(code)` (viem client extension) | `node_modules/@celo/attribution-tags/dist/index.d.ts`; BUILDERS.md / INDEXERS.md (2026-11-21) |
| Textile RFQ v2 | — | `POST /rfq/preview` (no auth); `POST /rfq/request` with `{ chainId, sellToken, buyToken, sellAmount \| buyAmount, taker, takerProof? }`, blocks up to ~75 s; broadcast `transactions.swap` from the taker after approving `quote.takerPays` to `quote.reactor` | fx-docs.textilecredit.com/api/v2/rfq.html, /authentication.html (2026-11-21) |
| `viem` | 2.57.20 | `createPublicClient`, `encodeFunctionData`, `erc20Abi`, `concat` | installed types |

## Contracts we call (Celo mainnet)
| Name | Address | Source of address | Verified how |
|---|---|---|---|
| USD₮ | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | event page; Altana fee list | spike balances; 6 decimals |
| cNGN | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` | event page | `decimals()` = 6 on forno |
| CELO (ERC-20 view of native) | `0x471EcE3750Da237f93B8E339c536989b8978a438` | Celo docs | Textile preview CELO→USD₮ |
| Textile LimitOrderReactor | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` | event page | matched `quote.reactor` in the spike |
| Porto Orchestrator (Altana) | `0xaf140d0416a994aebb3fa6212b16ce6700f09751` | `to` of every relayed spike tx | verified source on Celo Blockscout ("Orchestrator", solc 0.8.28); `execute(bytes)` and `execute(bytes[])` are public |
| Altana KeyStore (Celo) | `0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c` | event page | not yet read on-chain |
| Altana KeyStoreController (Celo) | `0x47bA5fc2A5b0CcB24BA3fAC9D4B59400eE9fd1D6` | event page | not yet read on-chain |
| **Albashi PayRun v2** (ours) | `0xfa8d963525d5F28427B897A0C761C744A43e59Af` | deployed by the agent 2026-11-22 (E-008) | 8,169 runtime bytes on forno; `TAKER_SIGNER` = agent; USD₮ held = `totalFloat` after the first run; source verified on Sourcify (runtime match, 2026-11-22): https://repo.sourcify.dev/42220/0xfa8d963525d5F28427B897A0C761C744A43e59Af |
| Albashi PayRun v1 (ours, retired) | `0x3Ef8f9A0dA701cE46b022b14E87315701D4bfeF7` | deployed 2026-11-22 | never funded; has no withdraw, so never send it USD₮; owner allowance zeroed and session permission removed (E-009, E-011) |
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | docs.celo.org/build/agents/8004 | ERC-1967 proxy → `IdentityRegistryUpgradeable` `0x7274…9c02`, verified on Celo Blockscout; `register(string agentURI)` mints to the sender and sets `agentWallet` = sender. Albashi is agent 10095 (E-013) |
| ERC-8004 Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | docs.celo.org/build/agents/8004 | doc only |

## Agent economy rails (verified 2026-11-22)
- **x402 on Celo:** facilitator API `https://api.x402.celo.org` (`/verify`, `/settle`, `/supported`; only `/settle` needs an `X-API-Key` from the x402.celo.org dashboard). Live config (`/api/config`) lists USD₮ and cNGN (our addresses) as mainnet payment assets. Fee: gas + 0.3% of the payment. Seller packages `@x402/express` / `@x402/hono`, `@x402/core`, `@x402/evm`. Facilitator-side ERC-8021 tagging of settlements is not live. (source: docs.celo.org x402 page; `curl /api/config`)
- **Self Agent ID:** SelfAgentRegistry on mainnet `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` (has code). Soulbound per-agent NFT backed by a ZK proof of a human; mainnet needs a real passport or ID in the Self app. Register with `@selfxyz/agent-sdk`. Separate from the reference ERC-8004 registry; an agent can be in both. (source: docs.celo.org self-agent-id page; `eth_getCode`)

## Traps
- **Altana relay buries the attribution tag.** The tag appended to inner calls lands inside the calldata; `verifyTx` returns null on the outer tx (E-002). Fix: self-relay (D-003). (source: spike, INDEXERS.md)
- **Textile proof of control from an Altana wallet:** the owner key's plain EIP-712 `TakerControl` signature is accepted (under EIP-7702 the wallet address is the owner EOA); the session key's ERC-1271 signature is rejected (`proof_of_control_invalid`). A smart-contract taker (PayRun) proves control through EIP-1271 with the agent's key. A proof is rejected as stale (`proof_of_control_stale`) a few minutes after `issuedAt`, so sign a fresh one for every quote request; a partner API key needs no proof. (source: spike; E-010 run, 2026-11-22)
- **Textile checks proof of funds on every firm quote:** the taker must already hold `takerPays` of the sell token (its balance, not an allowance), or the request fails `insufficient_funds` with `required`/`available`. Only the `rfq:aggregator` scope skips this, and it is not self-serve. This is why PayRun keeps a float (D-010). (source: PayRun v1 run and Textile's error body, 2026-11-22)
- **Textile holds the taker's balance against its open firm quotes,** a little past their `expiresAt`. A second quote for the same taker fails `insufficient_funds` until the first has lapsed. Ask for a firm quote only when about to run, and retry `insufficient_funds` for a few minutes. Firm quotes lasted about 2.5 min on 2026-11-22. (source: E-010 run)
- **Textile quotes expire ~60 s** and are bound to the taker; always broadcast `transactions.swap`, never the top-level `encodedOrder`. Minimum size is $1 of notional. (source: RFQ docs)
- **Altana key registration on Celo costs ~10–20 CELO** (≈ $1 at $0.055/CELO, 2026-11-21) per new session key, paid by the wallet. Budget it per pay run. (source: `quoteGrantSession` in the spike)
- **A session's fee-token cap also limits it:** `grantSession({ feeToken })` adds a daily cap on that token (default one whole token). A refusal can come from the fee cap, not the value cap. Set the fee cap wide when testing value caps. (source: spike, `spend_limit_exceeded` naming CELO)
- **`Orchestrator.execute(bytes)` returns an error code instead of reverting.** A failed intent can still mine as a *successful* transaction that did nothing. Always simulate (`eth_call`) and require `0x00000000`, then confirm the effect (balances), never just `receipt.status`. The intent bytes are `abi.encode(Intent)` with the 20-field struct from the verified source (`LibBytes.dynamicStructInCalldata(encodedIntent, 0x00)`). (source: Orchestrator verified source on Celo Blockscout, 2026-11-21)
- **Self-relay recipe (D-003):** the SDK's `execute` ends with the relay call `wallet_sendPreparedCalls({ context, signature, key })`. The Intent is `context.quote.quotes[0].intent`, with `signature = Key.wrapSignature(signature, { keyType, publicKey, prehash })` (porto 0.2.37 `porto/viem/Key`) for a session key. Verified on mainnet: E-005 (2026-11-21). (source: `@altananetwork/sdk` 1.1.0 `internal/relay.js`, porto `RelayActions`)
- **The SDK's `spend_limit_exceeded` message always names the fee token** ("…does not cover this in CELO"), whichever cap was hit. Tell caps apart by checking how much of each cap was used. (source: `@altananetwork/sdk` 1.1.0 `errors.js` `explainRelayFailure`; E-007)
- **Reading a balance right after a receipt on forno can return the old value.** Read with `blockTag: 'pending'` (or re-read until it changes) before deciding a swap failed. (source: E-005 run)
- **Re-granting a registered session key adds permissions; it does not replace them.** It costs only a relay fee (quoted 0.186, paid ≈ 0.086 CELO; no KeyStore fee). The old targets stay callable until removed. Remove one with `setCanExecute(keyHash, target, selector, false)`, sent by the owner EOA to its own address (under EIP-7702 that satisfies `onlyThis`; ~50k gas). Read the live set with `canExecutePackedInfos(keyHash)` and `spendInfos(keyHash)` on the account. (source: E-009, E-011)
- **Let a session key expire and renewing it costs a full KeyStore registration again** (about 10.13 CELO on 2026-11-22, the same for a 2-hour or a 60-day expiry). Re-granting a key while it is still live costs only the relay fee (≈ 0.09 CELO, E-009). So grant long expiries, and renew before expiry, never after. (source: `quoteGrantSession`, 2026-11-22 20:20 UTC, after the 09:26 UTC expiry)
- **Porto gives every session key "any function on the Orchestrator"** (`porto/dist/viem/Key.js`: `if (key.role === 'session' && orchestrator)` pushes `{ to: orchestrator, selector: 0x32323232 }`). It is not ours to remove, and the fee cap bounds what it can pay. We have not audited what else it allows. (source: porto 0.2.37; `canExecutePackedInfos`, 2026-11-22)
- **One PayRun.run intent paid Altana's relay 0.667 CELO** (`paymentAmount`), against the SDK's default fee cap of 1 CELO a day. So under the default only one run fits in a day; grant a wider fee cap for a real agency. The agent's own gas was 0.099 CELO. (source: E-010)
- **The agent needs ~0.4 CELO free to self-relay a run** though it spends ~0.1: `estimateGas` is over 1M, and viem reserves gas × 1.3 × maxFee (242.5 gwei at a 200 gwei base fee). A short balance fails before sending ("total cost … exceeds the balance"). (source: E-010 run)
- **Altana's relay refuses to price an intent whose calls revert,** with "An error occurred while executing calls. Reason: <revert data>": the contract's own error selector (PayRun's `NotSigned` = `0xa72952d8`). Nothing is signed or sent. (source: E-011)
- **forno can serve a read from a node that hasn't seen the last receipt,** even at `blockTag: 'pending'`: a contract deployed seconds earlier returned `0x` and `verifyTx` returned null. Retry reads straight after a write. (source: both PayRun deploys, 2026-11-22)
- **Blockscout can't verify a contract whose creation input ends with the attribution tag.** Its matcher takes everything after the bytecode as constructor arguments, and 128 bytes of arguments plus the 35-byte tag don't decode, so it fails without an error, by either API. Sourcify matches the runtime code instead and verifies it: `forge verify-contract <addr> src/X.sol:X --chain 42220 --verifier sourcify`. Blockscout's Etherscan-style API also rate-limits hard (`Too many requests`). (source: PayRun v2, 2026-11-22)
- **A self-relayed intent still pays Altana's relay fee** (`paymentAmount` to `paymentRecipient`, ~0.32 CELO on 2026-11-21) from the wallet, plus our own gas. (source: E-005)
- **After revoke, the relay error is "Key hash … is unknown"**, not a friendly message. Map it for the UI. (source: spike)
- **MetaMask counts CELO twice** (native + ERC-20 view) and doesn't list Celo's cNGN; import it by address. (source: the owner's wallet, 2026-11-21)
- **viem `getBalance` right after a mined tx can be stale on forno**; use `blockTag: 'pending'` before sweeping a balance. (source: spike refund)
- **Next 16's CSS pipeline silently drops `backdrop-filter` when a hand-written `-webkit-backdrop-filter` sits beside it with a `var()`-based value.** Both declarations vanish from the served stylesheet and the computed value is `none` (no frost, no error). Write only the unprefixed `backdrop-filter: blur(var(--frost-blur))`; the bundler adds the prefix. Check with `getComputedStyle(el).backdropFilter`. (source: apps/web hero build, 2026-11-21)

## Environment
| Var | Purpose | Where to get it |
|---|---|---|
| `ATTRIBUTION_CODE` | ERC-8021 code on every tx: `celo_3f5cac8c49f6` (public, not secret) | Loops House enrolment |
| `AGENT_KEY` | Albashi's agent EOA (self-relays intents, owns the ERC-8004 identity) | generate locally; never commit |
| `CELO_RPC_URL` | Celo RPC | `https://forno.celo.org` or Chainstack (Growth plan from the event) |
| `TEXTILE_API_KEY` | optional partner key (removes the per-wallet proof) | fx-docs.textilecredit.com/api/how-to-get-an-api-key.html |
