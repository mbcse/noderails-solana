# NodeRails: Product overview

> **Production company: limited public source**  
> NodeRails is a **live, launched product and company**. This repository is **not** our full production codebase. We publish **only a curated subset** of code for submissions, audits, and partner review. Large parts are **omitted or redacted** on purpose (build outputs, infrastructure, environment and key material, internal docs, and other sensitive paths) to limit **copy, competitive, and operational risk**. Some areas may be **stripped, abstracted, or non-representative** so the tree cannot be trivially cloned into a competing stack.  
> **For anything beyond what is here** (architecture depth, partnerships, integration packs, or diligence), contact **[mbcse50@gmail.com](mailto:mbcse50@gmail.com)**.

## The story: what Visa and Mastercard proved, and what crypto commerce still needed

Picture paying with a card in a shop or on the web. The tap or the “Pay now” click feels simple. Behind it is a **network**, not a single wire between you and the store. **Visa**, **Mastercard**, and other schemes sit between **issuers**, **merchants**, **acquirers**, and **processors** so that **authorization**, **risk rules**, and **settlement conventions** work at scale **without every merchant negotiating a bespoke pipe to every bank**. The plastic is a symbol; the real product is **shared rules**, **shared message shapes**, **clear roles**, and **rituals people already trust** (chip, PIN, 3-D Secure, OTP when the programme demands it).

That industry won for two reasons that matter for any new form of money. First, it made **mass-market UX** possible: you could train a billion users on **one habit**. Second, it made **innovation reusable**: a new retailer plugs into **rails** instead of reinventing authorization, reconciliation, and dispute language from zero.

**Public blockchains** added something those networks never had at their core: **open settlement**, **programmable assets**, and participation without permission from a single closed consortium. But they did **not** automatically ship the **retail layer** on top: the **roles**, **policies**, **evidence trails**, and **approval UX** that sponsors, risk teams, finance, and everyday shoppers expect. Blockchain gives you **programmable money**; it does not, by itself, give you **programmable money that behaves like infrastructure people already know how to run and regulate**.

That missing layer is where **NodeRails** sits. We are building **payment-grade infrastructure** and a **network story** around it, in the spirit of what card schemes made normal, but for **chains and programmes** that want to ship **now**, not after every team rebuilds custody, signing, indexing, and transaction ops by hand.

**NodeRails** (the platform) is the **merchant and developer side**: **hosted checkout**, **payment links**, **invoices**, **subscriptions**, **disputes**, **dashboards**, **APIs**, **webhooks**, **escrow**, **timelocks**, and lifecycle semantics your ops team can reason about. **WallCard** and the **NodeRails Card Network** are the **member and programme side**: the **wallet-as-card** habit (PAN-style identifiers, CVV, PIN, OTP, policy-gated step-up) and the **rails-and-roles** narrative so approval **feels like banking hygiene**, not a developer-only wallet popup, while **real signatures** still settle on chain. Under both, we run **first-party operations software**: **MTXM** (Multichain Transaction Manager) for **sign, broadcast, confirm** lifecycles with webhooks; **NodeRails Indexer** for **independent on-chain observation** of contracts and programmes; and a **fraud engine** for **wallet screening** when risk needs a signal before funds move.

So the product is intentionally **one story with two doors**. Through the **merchant door**, you get **Stripe-shaped** crypto commerce: objects you can create from an API, state you can trust, and webhooks your backend already knows how to handle. Through the **member door**, you get **Visa-shaped** familiarity: card-era steps and language, with **Solana and EVM** wallets operating under programme policy, not a lecture on seed phrases at checkout.

That is NodeRails in narrative form. The table below compresses the same idea into **named layers**; the sections after that walk **audiences**, **flows**, **on-chain design**, and **this repository**.

### Live product

- [noderails.com](https://www.noderails.com): marketing, docs, positioning  
- [merchant.noderails.com](https://merchant.noderails.com): merchant dashboard  
- [wallcard.noderails.com](https://wallcard.noderails.com): WallCard and network-facing demo  

---

## 1. The problem we solve (by audience)

These bullets restate the story above for **three** groups we talk to every week.

### Shoppers and cardholders

**Self-custody is a skill; retail is not a classroom.** Extension wallets assume people want to install software, parse errors, and guard seed phrases. Every friction point shows up in **abandonment**. Support costs explode when “not your keys” meets “I just wanted to buy a ticket.”

### Merchants and product teams

You cannot put **“download a wallet first”** ahead of **“complete purchase”** and still compete with cards and instant rails. You need **structured signing**, **predictable payment states**, and reporting finance can use **without** rebuilding custody, escrow, and risk plumbing on every launch.

### Issuers, schemes, and sponsors

Blockchains offer **settlement** and **programmability**; they do not hand you a **sponsor-ready network layer**: roles, programme rules, custody language, and **UX that matches how people already pay**. Pilot teams should not have to **re-derive** that stack from first principles each time.

---

## 2. What we build (at a glance)

The **Visa lesson** was **interoperability and habit**; the **NodeRails answer** is **interoperability and habit for programmable settlement**. The rows below name the pieces; read them after **The story** if you want the emotional arc first.

| Layer | What it is | Who it serves |
|--------|------------|----------------|
| **NodeRails (platform)** | Hosted checkout, payment links, invoices, subscriptions, disputes, merchant dashboard, APIs, webhooks, multi-chain configuration. Settlement uses **on-chain escrow** (contract/program per network) and shared product states across rails. | Merchants, developers, ops |
| **NodeRails SDK** | Server-side TypeScript client for creating and managing payment objects against the platform API. | Integrators (Node, Deno, Bun) |
| **WallCard** | **Wallet-as-card**: PAN/CVV/PIN/OTP-style approvals and `provider.request`-compatible signing so partners get a familiar integration surface without training every user as a wallet power user. Under the hood, members hold **EVM and Solana** wallet material governed by policy. | End users, issuers, programmes |
| **NodeRails Card Network** | Network-style **rails and roles** around programmable settlement: shared habits, APIs, and operating practice. **WallCard** is how that layer meets people and embedded commerce. | Programmes, partners, sponsors |
| **Fraud engine** | HTTP API that scores **Solana wallet addresses** (base58) using **Covalent GoldRush** foundational APIs; NodeRails stores a snapshot on **`PaymentIntent.metadata`** during Solana authorization when configured. | Risk, compliance, treasury |
| **Dodo Payments** | **First-class fiat card rail** beside crypto escrow: server-created **Dodo checkout sessions**, hosted card UX, **`/webhooks/dodo`** correlated to the same **checkout session / payment intent** as wallet pay — built for **ecosystem bounty** and **unified checkout**. | Card + crypto on one NodeRails checkout |
| **MTXM** | **Multichain Transaction Manager**: async **sign → broadcast → confirm** with webhooks. NodeRails submits and tracks many on-chain steps (EVM calldata and **Solana** instructions) through one lifecycle model. | Platform backend |
| **NodeRails Indexer** | **Multi-chain indexer**: registered contracts/programs, event logs, watched native transfers, HMAC webhooks; **observes** on-chain emissions for reconciliation and confirmation alongside MTXM. | Platform backend |

**Why NodeRails and WallCard belong together:** commerce needs **clear money movement** (escrow, capture, settlement, disputes) *and* **human-tolerant signing**. The platform handles merchant lifecycle and payment state; WallCard handles **member authorization** and **signing boundaries** so checkout can feel like a card while signatures stay policy-gated and explainable.

---

## 3. Repository layout (this bundle)

| Directory | Contents |
|-----------|----------|
| `noderails/` | Main monorepo: **landing** (`apps/landing`, docs as React), **dashboard**, **admin**, **payment UI**, **`noderails-server`**, **packages** (web3, solana, common, database, queue, **mtxm-client**, **indexer-client**, …), **EVM contracts** (`noderails-contracts`, Foundry), **Anchor** programs (`noderails-solana/`, including `target/idl/*.json` for tooling where checked in). |
| `noderails-sdk/` | `@noderails/sdk`: TypeScript SDK for the HTTP API (`src/`, tests). |
| `noderailsCardNetwork/` | **WallCard**: `apps/web`, `apps/wallet`, `apps/dashboard`, `apps/mobile`, `services/api`, `services/signer-host`, `services/worker`, shared `packages/*`, `enclaves/signer` (Nitro-oriented assets). |
| `noderails-fraud-engine/` | Wallet screening service (`src/`), HTTP API as implemented in code. |

This tree is a **curated snapshot**: dependency folders, most markdown, env files, keys, and build outputs were excluded on purpose. Narrative for external readers starts here; more product copy appears in `noderails/apps/landing/src/app/page.tsx` and `noderails/apps/landing/src/app/docs/**/page.tsx`.

---

## 4. Merchant and developer flow

### Product surface

**Comprehensive crypto payment infrastructure**: hosted checkout, links, subscriptions, invoices, fraud/compliance hooks, disputes/refunds, and a developer API. Chains and tokens are enabled per app in the dashboard and can be refined per API request where supported.

### Typical merchant journey

1. **Account & app:** Sign up, verify email, create an **App** with API keys (`nr_<env>_<pk|sk>_…`).  
2. **Wallets:** Connect **receiving and payout** addresses per enabled network (**EVM** `0x…` and/or **Solana** base58, depending on what you turn on).  
3. **Rails:** Choose chains and tokens; override per checkout or payment intent when the API allows.  
4. **Integrate:** Create checkout sessions, payment links, invoices, or subscriptions via **HTTP API** or **`@noderails/sdk`**.  
5. **Operate:** Track authorization through capture, settlement, disputes, payouts, and **webhooks**.

Where enabled, the same hosted checkout can offer **crypto wallet pay** and **Dodo card checkout** on one **checkout session** (payment links, invoices, and session URLs).

Hosted checkout lives under `noderails/apps/payment-ui`; merchant tooling under `noderails/apps/dashboard` and `noderails/apps/admin`.

### Payment lifecycle (conceptual)

1. Customer pays via **checkout**, **payment link**, **invoice**, or **subscription** bill.  
2. Funds follow **escrow and/or timelock** rules on the selected chain (EVM contract or **Solana** program, depending on configuration).  
3. **Settlement**, **refunds**, and **disputes** map to the correct on-chain actions for that network; **MTXM** and the **indexer** keep server state aligned with what actually confirmed on chain.

Product states (authorized, captured, settled, disputed, refunded, and similar) are shared across rails; the exact bytecode or instruction surface depends on the chain type.

---

## 5. On-chain escrow: EVM and Solana

NodeRails supports **both** EVM and **Solana** escrow paths in production. This bundle includes representative code for each:

- **EVM:** Solidity escrow (and related contracts) under `noderails-contracts/`; dashboard wallet flows use common EVM tooling.  
- **Solana:** **Anchor** programs under `noderails-solana/programs/` (for example `noderails_escrow`, merchant manager) with **IDL JSON** under `noderails-solana/target/idl/` where present for client generation. For Solana-backed configuration, `escrowAddress` stores the **program id** (base58), not an EVM address.

**Solana-specific mechanics** (when you use those clusters): **native SOL** capture typically expects the **user wallet** to submit the transaction built from returned data; **SPL** flows use **delegation** to an **`escrow_auth` PDA** (`seeds = [b"escrow_auth"]`), with **MTXM** submitting and tracking server-side **capture_spl** and related steps after delegation. **Timelocks** are packed into instruction data using shared helpers (`packTimelocks` / `timelocksToHex`) so UI and programs agree. **Subscriptions:** native SOL renewals that need a fresh user signature each period are not silently auto-billed; SPL can follow the same delegation pattern as one-shot checkout when policy allows.

TypeScript for Solana PDAs, encoding, and flows lives in **`@noderails/solana`** (`noderails/packages/solana`); shared encoding and EVM helpers live in **`@noderails/web3`** and related packages.

---

## 6. MTXM and NodeRails Indexer (first-party infrastructure)

NodeRails is not only contracts and apps: we built **two backends** that sit beside `noderails-server` and keep payments reliable in production.

### MTXM (Multichain Transaction Manager)

**MTXM** runs an **async pipeline** for **signing, broadcasting, and confirmation**. Submitted work progresses through states such as **QUEUED → SIGNING → SIGNED → BROADCASTING → BROADCAST → CONFIRMED** (with failure and recovery paths your automation can subscribe to).

**Role in NodeRails**

- **EVM:** nonce-aware sends, gas and confirmation handling, webhooks for lifecycle transitions.  
- **Solana:** same lifecycle pattern for **server-submitted** transactions (notably **SPL escrow** paths after user delegation).  

NodeRails consumes **MTXM webhooks** (`/webhooks/mtxm`) so **PaymentIntent** and **Transaction** records advance with on-chain reality. Code: **`packages/mtxm-client`**, wiring in **`noderails-server`** (ingest, workers).

### NodeRails Indexer

**NodeRails Indexer** **indexes contracts and programs**, follows **events / logs**, can watch **native transfers** for configured addresses, and sends **HMAC-signed webhooks** when matches occur. It supports **EVM** and **Solana** (`protocol: evm` / `protocol: solana`), including **Anchor**-oriented registration and **IDL** decoding where configured.

**Role in NodeRails**

- Delivers a **second path** next to MTXM: “what did the chain actually emit?” for reconciliation, enrichment, and duplicate-safe confirmation.  
- NodeRails accepts **`/webhooks/indexer`** and uses **`@noderails/indexer-client`** for Project API calls.

| Path | Role |
|------|------|
| **MTXM** | Submit the signed work and track it through **finality**. |
| **Indexer** | Observe **events and transfers** for registered programmes/contracts and notify the app. |

### Chain intelligence (GoldRush / Covalent)

Beyond raw submission and event pipes, **operations and reconciliation** treat **Covalent GoldRush** as part of the **chain-intelligence layer** that informs how we interpret MTXM confirmations and indexer-derived evidence (supply/holder context, historical activity, pricing overlays where applicable). **MTXM** and **NodeRails Indexer** remain our **first-party execution and observation** products; GoldRush data feeds adjacent risk and diligence workflows rather than replacing those components.

---

## 7. WallCard and the NodeRails Card Network

### Product concept

**WallCard** is a **card-shaped crypto wallet**: not “another extension,” but a **virtual payment card** mental model. Approvals use familiar e-commerce steps (**card number → CVV → PIN → OTP**). Under the hood, each member maps to **EVM and Solana** wallets; signing goes through **`provider.request`**-style surfaces so dApps integrate like they would with mainstream wallet tooling.

### NodeRails Card Network (analogy)

Traditional card networks made **many institutions interoperable** behind **one customer habit**. Public blockchains provide settlement but not the full **retail network layer** (roles, rules, mainstream UX). **NodeRails Card Network** is our layer for that gap; **WallCard** is how members and merchants experience it.

### System shape (WallCard monorepo)

```
Client apps (web, wallet, dashboard, mobile)
        │  HTTPS
        ▼
services/api: Auth (email OTP → JWT), onboarding (PIN hashing), orchestration, signing *requests*
        │  internal HTTP (e.g. x-signer-token)
        ▼
services/signer-host: IKeyProvider: key generation, threshold reassembly policy, signing
        │
services/worker: BullMQ jobs (e.g. OTP email via SES)
```

**Key invariant:** only **`services/api`** is internet-exposed; **`signer-host`** is internal. Raw card data (PAN, CVV, PIN) **does not** go to the signer service in the described flow.

### Authentication and onboarding (summary)

1. **OTP:** `POST /v1/auth/otp/request` → email code; `POST /v1/auth/otp/verify` → JWT (`needsSetup` indicates first-time onboarding).  
2. **Onboarding:** `POST /v1/auth/onboarding/setup` with PIN; PIN hashed (e.g. argon2id) and stored; **signer** provisions **EVM + Solana** wallet references via `IKeyProvider`.

### Signing flow (summary)

**`services/api`** verifies credentials, then **`signer-host`** applies **`IKeyProvider`** (production key provider, dev Shamir paths, future Nitro-oriented providers). **Shamir secret sharing** and **AWS Nitro Enclaves** (where deployed) support threshold custody and isolated signing stories partners can diligence.

### Who WallCard is for

- Consumer and retail programmes that need **card-era habits** at the UI without dumbing down on-chain requirements.  
- Merchants embedding approvals without training every user as a wallet power user.  
- Issuers and pilots that must explain **keys, shares, signing locus, and approvals** to sponsors and risk.

---

## 8. Dodo Payments (card rail)

NodeRails treats **Dodo Payments** as a **strategic card partner**, not a bolt-on demo. Real merchants need **fiat card checkout** next to **crypto escrow** on the **same** payment links, invoices, and hosted UI — the same product story as “Stripe-shaped commerce + on-chain settlement,” with **Dodo** powering the card acquirer path we ship for **partner programs and ecosystem bounties**.

**Why Dodo matters here**

- **Unified checkout:** one **checkout session** can surface **Pay with wallet** (authorize → escrow → **MTXM** / **indexer** lifecycle) and **Pay with card** (Dodo-hosted) so shoppers and ops see a single NodeRails flow, not two disconnected products.
- **Fiat ↔ crypto positioning:** session **fiat totals** drive the **Dodo `product_cart`**; the wallet rail still runs **authorize / capture** on the merchant’s enabled chain and tokens.
- **Bounty-ready integration:** we implement the full server path reviewers expect — **`POST /checkouts`**, **`POST /webhooks/dodo`**, Standard Webhooks verification, and **`metadata`** (`noderails_checkout_session_id`, `noderails_app_id`) so Dodo events correlate back to NodeRails sessions and intents (grep-friendly in this repo, same pattern as **`/webhooks/mtxm`** and **`/webhooks/indexer`**).

**How it works in this repo**

1. **Payment UI** (`noderails/apps/payment-ui`): when `NEXT_PUBLIC_ENABLE_DODO_CARD=true`, checkout shows **Pay with card**. The browser calls **`POST /checkout-sessions/public/:checkoutSessionId/dodo-session`** on **`noderails-server`** — API keys stay server-side only.
2. **Server** (`noderails/services/noderails-server/src/modules/payments/dodo-payments.service.ts`, `dodo-payments.client.ts`): validates the NodeRails checkout session, maps the fiat total to Dodo’s **`product_cart`** (USD cents today — configure a **pay-what-you-want** / priced product in the Dodo dashboard), sets **`metadata`** for correlation, and calls Dodo’s **`POST /checkouts`** (`Authorization: Bearer`, `test.dodopayments.com` or `live.dodopayments.com`).
3. **Return**: `{ checkoutUrl, dodoSessionId }` — the UI opens Dodo’s hosted checkout.
4. **Webhooks**: point Dodo at **`POST /webhooks/dodo`** (`webhook-id`, `webhook-timestamp`, `webhook-signature`; verified with **`DODO_PAYMENTS_WEBHOOK_SECRET`**). Deliveries merge **`metadata.dodoWebhook`** on **`CheckoutSession`** and linked **`PaymentIntent`** so **card completion** is visible in the same system of record as crypto — **on-chain escrow** remains the wallet rail’s authorize/capture path in the existing payment modules (dual-rail architecture).

**Environment (names only)**

- `DODO_PAYMENTS_ENABLED`, `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET`, `DODO_PAYMENTS_BASE_URL`, `DODO_PAYMENTS_PRODUCT_ID`, `PAYMENT_UI_PUBLIC_URL`
- Browser flag: `NEXT_PUBLIC_ENABLE_DODO_CARD`

---

## 9. Fraud engine & Covalent GoldRush

The **`noderails-fraud-engine`** service scores **Solana** wallets using **GoldRush Foundational** REST APIs against **`https://api.covalenthq.com`** (`GoldRushClient` in [`noderails-fraud-engine/src/goldrush/client.ts`](noderails-fraud-engine/src/goldrush/client.ts)). It merges **balances**, **transactions_v3** (including optional pagination via `links.next` in [`assess.ts`](noderails-fraud-engine/src/assess.ts)), and **transaction summaries**, then applies deterministic rules in [`risk-engine.ts`](noderails-fraud-engine/src/engine/risk-engine.ts).

**HTTP API** (`noderails-fraud-engine/src/server.ts`): e.g. **`GET /v1/solana/wallets/{address}/assessment`** returns a **`ComplianceReport`** with score, tier, and findings. Responses carry **`X-Service-Id: noderails-fraud-engine`**. **`GET /v1/status`** lists capability flags.

**NodeRails wiring**

When **`FRAUD_ENGINE_URL`** is set, **`authorizeFromCheckoutSession`** (Solana payer, [`authorize.service.ts`](noderails/services/noderails-server/src/modules/payments/authorize.service.ts)) calls the fraud engine via [`fraud-engine.client.ts`](noderails/services/noderails-server/src/modules/risk/fraud-engine.client.ts) and stores **`fraudTier`**, **`fraudScore`**, **`fraudFetchedAt`**, **`fraudFindingCount`** on **`PaymentIntent.metadata`**. Failures are **non-blocking** (logged).

**Deployment pattern**

1. Run `noderails-fraud-engine`; keep **`GOLDRUSH_API_KEY`** only on that host.  
2. Configure **`FRAUD_ENGINE_API_TOKEN`** on the fraud engine and **`FRAUD_ENGINE_CLIENT_TOKEN`** on NodeRails (same value).  
3. Tune thresholds in **`risk-engine.ts`** for your risk posture.

---

## 10. How the pieces fit

**Commerce:** merchants integrate via **`@noderails/sdk`** and the **NodeRails API**; customers use **hosted checkout / payment UI**.

**Settlement:** the backend drives **EVM contracts** and/or **Solana programs** per payment. **MTXM** executes and tracks many on-chain steps; **NodeRails Indexer** **observes** events for dual-path confirmation and ops.

**WallCard:** member apps use the **card network API** and isolated **signer-host** for policy-gated signatures.

**Risk:** the **fraud engine** supplies **Solana wallet** assessments when the platform needs them (GoldRush-backed; see §9).

**Dodo Payments:** fiat **card** completion on the **same checkout** as crypto — server sessions, hosted UX, and webhooks (§8); positioned for **ecosystem bounty** builds and **merchant fiat + crypto** in one product.

**In short:** NodeRails is the **system of record**; **MTXM + Indexer** execute and observe on-chain steps; **Dodo** covers **card fiat** on unified checkout; **WallCard** is **member signing with card UX**; the **fraud engine** is **orthogonal risk**; the **SDK** is the **typed API surface** for backends.

---

## 11. Where to look in `noderails/`

Standalone `.md` files were mostly stripped from this snapshot; use **code and landing** as the map:

| Need | Where |
|------|--------|
| Landing & WallCard narrative | `noderails/apps/landing/src/app/page.tsx` |
| Docs-style pages (getting started, API, SDK) | `noderails/apps/landing/src/app/docs/**/page.tsx` |
| EVM contracts (Foundry) | `noderails/noderails-contracts/` |
| Solana programs + IDL | `noderails/noderails-solana/programs/`, `noderails/noderails-solana/target/idl/*.json` |
| Solana TS helpers | `noderails/packages/solana/` |
| MTXM / indexer clients | `noderails/packages/mtxm-client/`, `noderails/packages/indexer-client/` |
| Webhook ingest (`/webhooks/mtxm`, `/webhooks/indexer`, `/webhooks/dodo`) | `noderails/services/noderails-server/src/modules/payments/` |
| Dodo card rail | `.../dodo-payments.service.ts`, `.../dodo-payments.client.ts`, `.../dodo-webhook-verify.ts` |
| Fraud engine HTTP client (platform) | `.../risk/fraud-engine.client.ts` |
| Fraud engine service | `noderails-fraud-engine/src/` |
| Other server modules | `noderails/services/noderails-server/src/` |

---

## 12. Vision

NodeRails exists so teams can **accept crypto** with **gateway-grade checkout**, **escrow and timelocks**, **disputes**, **risk hooks**, and **signing that real people can complete** (**WallCard**). We combine merchant rails with **operator-owned** transaction and indexing infrastructure (**MTXM**, **Indexer**) instead of bolting every chain into a single fragile script.

---

## 13. Contact

- **This repository / more detail:** [mbcse50@gmail.com](mailto:mbcse50@gmail.com)  
- **Business / programmes:** business@noderails.com (see live site).  
- **WallCard integration:** staging URLs, CORS, SDK pinning, signer boundaries, and **key-share / operating policy** for your programme.

---

*This file is a **product-oriented** overview of an **intentionally partial** public bundle. It does not replace our private monorepo, hosted MTXM/indexer deployments, or partner-specific materials.*
