# 🌿 GreenTrace

**Continuous, on-chain green-bond verification & issuance on the XRP Ledger.**

## The problem

The green-bond market is ~$2.9T, and new rules (EU Green Bond Regulation, CSRD, anti-greenwashing)
now make "green" a *legal* claim you must keep proving. Crucially, **external review is no longer
optional** — under the EU Green Bond Regulation (**Regulation (EU) 2023/2631**), bonds marketed as
European Green Bonds require **mandatory verification by an ESMA-registered external reviewer, at both
pre- and post-issuance.** Yet the infrastructure hasn't kept up: a bond is reviewed **once**, with a
PDF — after that, covenants can slip, standards can change, and a treasury holding the bond has no
live way to prove it's still green.

## The solution

**GreenTrace is the missing verification layer.** Instead of a one-off PDF, a bond's green status —
and its legally-required verifier attestation — lives **on-chain** and updates in real time.

End-to-end on XRPL:

- 🏛 **Treasury** issues a bond as a token with its green framework, standards, and covenants embedded on-chain.
- 🔍 **Verifier** (an ESMA-registered reviewer — e.g. KPMG / Sustainalytics) attests green status with an on-chain credential — the external review the law mandates, now machine-verifiable — and it can be **revoked the moment a covenant breaches**.
- 💼 **Investors** deposit RLUSD into a single-asset vault and receive MPT shares — and **only credentialed (KYC'd) wallets can hold the bond**; an uncredentialed wallet is rejected *at the protocol level* (`tecNO_AUTH`).
- 🔒 **Proceeds** sit in milestone-gated escrow and release only when the verifier attests each milestone.
- 🤖 A **compliance monitor** continuously checks covenants and **flags** drift for the verifier to act on (it never changes status itself).

Every figure is labelled by source — **on-chain / verifier-attested / self-reported** — so you always
know what the ledger can *prove* vs. what's reported.

**Green status rule:** a bond is COMPLIANT only if it passes all three core standards — **ICMA,
EU Taxonomy, Climate Bonds** — recorded as results in its on-chain credential.

## Built natively on the XRP Ledger

| Amendment | XLS | Role in GreenTrace |
|---|---|---|
| **Multi-Purpose Tokens** | XLS-33 | The bond instrument + vault shares; green metadata embedded on-chain |
| **Credentials** | XLS-70 | Green-verification + investor-KYC credentials, issued/revoked on-chain |
| **Permissioned Domains** | XLS-80 | Compliance boundary — only credentialed wallets can hold a bond |
| **Token Escrow** | XLS-85 | Milestone-gated release of RLUSD proceeds |
| **Single Asset Vault** | XLS-65 | Investors deposit RLUSD → receive MPT shares |
| **RLUSD** | — | Settlement asset throughout |
| *Lending Protocol* | *XLS-66* | *Roadmap (V2): the vault lends proceeds to the issuer — terms captured, not yet on-chain* |

> Runs on **XRPL Devnet**, where these amendments are live, so transactions are **real and
> validated** — every tx hash links to `devnet.xrpl.org`. If a submission can't land, the app
> transparently **falls back to a deterministic simulated record** flagged in the UI, so a demo never
> breaks. (On Devnet, "RLUSD" is a self-issued test IOU standing in for canonical RLUSD; the
> compliance monitor is a deterministic **preview of the planned V2 AI agent**.)

---

## Quick start

```bash
npm install          # installs backend + frontend workspaces
npm run dev          # starts backend (:3001) and frontend (:5173) together
```

Open **http://localhost:5173** and sign in with a demo account (see below). On first run the backend
automatically (≈2 min on Devnet):

1. Generates + faucet-funds 4 Devnet wallets (issuer, investor, verifier, **buyer**)
2. Sets up a self-issued RLUSD test IOU + trustlines
3. Creates an XLS-80 permissioned domain and issues an `InvestorKYC` credential to the investor
4. Issues 3 demo bonds on-chain, each with an escrow, a green credential, and an **XLS-65 vault**

All state (including wallet seeds) lives in `backend/greentrace.db` (gitignored). Delete it to reseed.

> Requires Node ≥ 20 and outbound network access to the XRPL Devnet faucet + node.

### Logging in (demo accounts)

Role-based login — each persona signs in and sees only their pages and actions, while everyone reads
the same on-chain truth. Demo accounts (password `green2026`, also shown on the login screen):

| Username | Role | Lands on | Can do |
|---|---|---|---|
| `treasury` | 🏛 Treasury (issuer) | Dashboard | Issue bonds, manage escrow, run the Compliance Monitor |
| `investor` | 💼 Investor (buyer) | Marketplace | Browse bonds, deposit RLUSD into a vault, buy & settle in RLUSD |
| `kpmg` | 🔍 Verifier (KPMG) | Review Queue | Attest green status (issue/revoke credential) |

(Demo-only credentials — not real auth; actions are also gated on-chain by the wallet's credential.)

---

## Demo flow (what a judge sees)

1. **Sign in** as `treasury` → **Dashboard**: 3 bonds, all COMPLIANT and credentialed, with a live
   Compliance Monitor feed.
2. **Run Monitor** — it detects Coastal Wind's emissions breach (1200 > 1000 tCO₂e) and **flags it for
   verifier review** (recommend BREACH). Status and credential are **not** changed — the monitor never
   acts on-chain. *(First auto-cycle is delayed `AGENT_START_DELAY_MS` so this stays under your control.)*
3. **Sign in** as `kpmg` → **Review Queue** → open the flagged bond → **Attest** → status flips to
   **BREACH** and the green credential is **revoked on-chain** (real `CredentialDelete`).
4. **Sign in** as `investor` → **Marketplace** → open a bond:
   - **Deposit into Vault** — deposit RLUSD → receive MPT shares (XLS-65); they appear in **My Wallet**.
   - **Buy this bond** — real `MPTokenAuthorize` + MPT delivery + **RLUSD settlement**. The collapsible
     *"unverified wallet"* demo shows the on-chain **`tecNO_AUTH`** rejection.
5. Back as `treasury` → **Issue Bond** — the **6-step wizard** (basics → framework/standard + verifier
   → milestones → vault & loan terms → investor access → review) → **Mint** → *"Bond minted and vault
   opened"*: real MPToken issuance, escrow, **vault**, and an initial verifier attestation.
6. **Release a milestone** (treasury) — `EscrowFinish`, milestone-gated.

Every real tx hash links to `https://devnet.xrpl.org/transactions/{hash}`.

---

## Screens & personas

Three actors; the UI tags each panel/action with the responsible actor (🏛 Treasury · 🔍 Verifier · 💼 Investor).

| Actor | Role | Their screens |
|---|---|---|
| 🏛 **Treasury (issuer / seller)** | Issues bonds, holds proceeds in escrow, runs monitoring | **Dashboard**, **Issue Bond** (6-step wizard), **Compliance Monitor** |
| 🔍 **Verifier (KPMG)** | ESMA-registered reviewer; attests green status on-chain | **Review Queue**, **Compliance Monitor** |
| 💼 **Investor (buyer)** | Deposits into the vault / buys the bond; must be credentialed to hold it | **Marketplace**, **My Wallet** (portfolio) |

Shared per-bond pages (gated by role): **Bond detail** — Instrument & Verification, Escrow, Verifier
Review, Vault deposit, and the Buy panel — and a green **Certificate** page. Selling is the treasury's
act of issuance; buying/depositing happens per-bond, where the price, terms, green status, and
credential gate all live.

---

## Architecture

- **Backend** — Node + Express + `better-sqlite3`, `xrpl.js v4`. See [docs/architecture.md](docs/architecture.md).
- **Frontend** — React 18 + Vite + Tailwind, role-based dark UI, live updates via SSE + polling.
- **XRPL transaction reference** — [docs/xrpl-transactions.md](docs/xrpl-transactions.md).

```
greentrace/
├── backend/src/
│   ├── xrpl/      client, wallet, mpt, escrow, credentials, domain, iou, rlusd, vault, safeSubmit
│   ├── agent/     verifier (rule engine + loop + SSE), mockData
│   ├── routes/    auth, wallets, bonds, escrow, credentials, agent, rlusd, portfolio, vault
│   ├── standards.js  greenMeta.js  db.js  config.js  seed.js  index.js
└── frontend/src/
    ├── components/  Login, Dashboard, BondCard, BondDetail, IssueBond, Marketplace, Portfolio,
    │                ReviewQueue, Certificate, EscrowPanel, InstrumentPanel, VaultPanel, BondAccess,
    │                VerifierReview, CredentialBadge, AuditTrail, AgentLog, SeedingBanner, ui
    └── auth.jsx  api.js  App.jsx  main.jsx
```

## Configuration (`backend/.env`)

| Var | Default | Notes |
|---|---|---|
| `PORT` | `3001` | backend port (Render injects this in production) |
| `XRPL_NODE` | `wss://s.devnet.rippletest.net:51233` | Devnet node (use `s.altnet…` for Testnet) |
| `DB_PATH` | `./greentrace.db` | SQLite file |
| `RLUSD_CURRENCY` | `524C5553…` | RLUSD currency hex |
| `RLUSD_ISSUER` | `rQhWct2fv4…` | Canonical RLUSD issuer (proceeds use a self-issued IOU on Devnet) |
| `AGENT_INTERVAL_MS` | `30000` | compliance-monitor cycle cadence |
| `AGENT_START_DELAY_MS` | `120000` | grace before the first auto-cycle |

## Deploy on Render

GreenTrace ships as a **single web service**: Express serves the REST/SSE API *and* the built React
SPA from one origin (no CORS, one URL). A [`render.yaml`](render.yaml) Blueprint is included.

1. Push this repo to GitHub.
2. Render → **New → Blueprint**, select the repo. Render reads `render.yaml`:
   - build: `npm install --include=dev && npm run build` (builds `frontend/dist`)
   - start: `npm start` (Express serves the API + `dist`)
   - health check: `/api/health`
3. Deploy. Open the service URL — the app, API, and live monitor feed all run on that one origin.

**Free-tier notes:** the filesystem is ephemeral and the service spins down when idle, so each cold
start **re-seeds on Devnet (~2 min)**. The server is responsive immediately (it listens before
seeding) and shows an "initializing" state until data arrives. No secrets are deployed — wallet seeds
are generated at runtime into the gitignored SQLite file. For instant, persistent data, attach a
Render disk and point `DB_PATH` at it (requires a paid instance).

To run the production build locally: `npm install --include=dev && npm run build && PORT=10000 npm start`,
then open `http://localhost:10000`.

## Notes

- **No seeds in source** — wallet seeds are stored only in SQLite (gitignored).
- The compliance monitor is graceful: if XRPL is unreachable it logs and continues; the server never crashes.
- Seeding is idempotent — restart `npm run dev` and it won't duplicate on-chain state.
- `GET /api/health` reports XRPL connectivity, domain id, RLUSD status, and wallet balances; `GET /api/status` is a lightweight seeding flag.
