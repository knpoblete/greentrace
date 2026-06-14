# 🌿 GreenTrace

Real-time **green bond verification & issuance** platform built natively on **XRPL Devnet**.
GreenTrace gives treasury professionals a single dashboard showing the live green-compliance
status of every bond they hold or issue — backed by real on-chain transactions.

It combines four XRPL features end-to-end:

| Feature | XLS | Used for |
|---|---|---|
| **MPTokens** | XLS-33 | Bond token issuance with embedded green metadata |
| **TokenEscrow** | XLS-85 | Locking RLUSD proceeds until milestones are met |
| **Credentials** | XLS-70 | On-chain green-verification badges, issued/revoked by the reviewer (**KPMG**) |
| **Permissioned Domains** | XLS-80 | Compliance boundary — only credentialed wallets can hold a bond |

A local, deterministic **rule-based compliance monitor** (no external AI API) continuously checks
every bond and **flags** changes for review. It's a **working preview of the V2 AI monitoring agent**
on the roadmap (which would also assemble ESRS/ISSB reporting). Per the business-plan governance
model, it never finalises a status change or moves funds itself — a credentialed reviewer (**KPMG**)
attests changes on-chain (issuing or revoking the green credential). **Green status rule:** COMPLIANT only if the bond passes all three
core standards — ICMA, EU Taxonomy, Climate Bonds — recorded in the on-chain credential.

> Runs on **XRPL Devnet** (matches the business plan), where all four amendments are live, so
> transactions are **real and validated** — every tx hash links to `devnet.xrpl.org`. If a submission
> can't land, the app transparently **falls back to a deterministic simulated record** flagged in the
> UI, so a demo never breaks. Every dashboard figure carries a **source label** (on-chain /
> verifier-attested / self-reported).

---

## Quick start

```bash
npm install          # installs backend + frontend workspaces
npm run dev          # starts backend (:3001) and frontend (:5173) together
```

Open **http://localhost:5173**. On first run the backend automatically:

1. Generates + faucet-funds 4 Testnet wallets (issuer, investor, verifier, **buyer**)
2. Sets up a self-issued RLUSD test IOU + real trustlines to the Testnet RLUSD issuer
3. Creates an XLS-80 permissioned domain
4. Issues 3 demo bonds on-chain (2 compliant, 1 that will breach)
5. Creates escrows and issues KPMG green credentials
6. Issues an `InvestorKYC` credential to the investor (Wallet A)

All state (including wallet seeds) lives in `backend/greentrace.db` (gitignored). Delete it to reseed.

> Requires Node ≥ 20 and outbound network access to the XRPL Devnet faucet + node.

---

## Demo flow (what a judge sees)

1. **Dashboard** — 3 bonds, all COMPLIANT and KPMG-credentialed; live Compliance Monitor feed on the right.
2. **Click "Run Monitor"** (Compliance Monitor, a V2 preview) — it detects Coastal Wind's emissions
   breach (1200 > 1000 tCO₂e) and **flags it for verifier review** (recommend BREACH). The status and
   credential are **not** changed — the monitor never acts on-chain.
   *(The auto-loop is delayed `AGENT_START_DELAY_MS` so this stays under your control.)*
3. **Open Coastal Wind → Verifier Review panel → "Attest as KPMG → BREACH"** — the credentialed
   reviewer finalises it: status flips to **BREACH** and the green credential is **revoked on-chain**
   (real `CredentialDelete`).
4. **Permissioned Access panel** — click *Attempt to Buy Bond*:
   - **Wallet A** (holds `InvestorKYC`) → **✓ ACCEPTED**: real `MPTokenAuthorize`, MPT delivery, and
     **RLUSD settlement** (investor → issuer).
   - **Wallet B** (no credential) → **⛔ REJECTED on-chain with `tecNO_AUTH`** (no settlement).
5. **Issue a new bond** — 4-step form (multi-select standards) → real MPToken issuance + escrow + an
   initial KPMG attestation, all on-chain.
6. **Release a milestone** — `EscrowFinish` tx, milestone-gated.
7. **RLUSD panel** — trustline + a "pay proceeds" payment (self-issued RLUSD IOU; top up at
   [tryrlusd.com](https://tryrlusd.com) for canonical RLUSD).

Every real tx hash links to `https://devnet.xrpl.org/transactions/{hash}`.

---

## Screens & personas

GreenTrace models three actors. The UI tags each panel/action with the actor responsible
(🏛 Treasury · 🔍 Verifier · 💼 Investor) so it's clear who does what.

| Actor | Role | Where in the app |
|---|---|---|
| 🏛 **Treasury (issuer / seller)** | Issues bonds and raises capital; holds proceeds in escrow | The **Dashboard**, the **Issue Bond** flow, and the **Instrument** + **Escrow** panels |
| 🔍 **Verifier (KPMG)** | ESMA-registered reviewer; attests green status on-chain (issue/revoke credential) | The **Verifier Review** panel on a bond page |
| 💼 **Investor (buyer)** | Buys the bond and settles in RLUSD; must be credentialed to hold it | The **Investor Purchase** panel on a bond page |

**The two screens:**

- **Dashboard** — the *treasury's* book: every bond it has issued, with live green status, escrow
  totals, and the Compliance Monitor feed. This is the seller's overview. "Run Monitor" runs the
  compliance monitor (a V2 preview that only flags); "Issue Bond" starts a new issuance.
- **Bond detail** — one instrument, with the actions of all three actors in one place:
  the **Instrument & Verification** and **Escrow** (🏛 treasury), the **Verifier Review** (🔍 KPMG
  attestation), and the **Investor Purchase** panel (💼 buyer) where Wallet A (credentialed) buys —
  delivery + **RLUSD settlement** — and Wallet B (no credential) is rejected on-chain. So **selling is
  the treasury's act of issuance; buying happens per-bond on the bond page**, which is where the
  price, terms, green status, and credential gate all live.

(Plus **Compliance Monitor** — the full monitoring history (V2 preview) — and **Issue Bond** — the 4-step issuance form.)

### Logging in (demo accounts)

GreenTrace has **role-based login** — each persona signs in and sees only their pages and actions,
while everyone reads the same on-chain truth. Demo accounts (password `green2026`, also shown on the
login screen):

| Username | Role | Lands on | Can do |
|---|---|---|---|
| `treasury` | 🏛 Treasury (issuer) | Dashboard | Issue bonds, manage escrow, run the Compliance Monitor |
| `investor` | 💼 Investor (buyer) | Marketplace | Browse & buy bonds (RLUSD settlement) |
| `kpmg` | 🔍 Verifier (KPMG) | Review Queue | Attest green status (issue/revoke credential) |

(Demo-only credentials — not real auth; actions are also gated on-chain by the wallet's credential.)

---

## Architecture

- **Backend** — Node + Express + `better-sqlite3`, `xrpl.js v4`. See [docs/architecture.md](docs/architecture.md).
- **Frontend** — React 18 + Vite + Tailwind, dark treasury UI, live updates via SSE + polling.
- **XRPL transaction reference** — [docs/xrpl-transactions.md](docs/xrpl-transactions.md).

```
greentrace/
├── backend/src/
│   ├── xrpl/      client, wallet, mpt, escrow, credentials, domain, iou, rlusd, safeSubmit
│   ├── agent/     verifier (rule engine + loop + SSE), mockData
│   ├── routes/    wallets, bonds, escrow, credentials, agent, rlusd
│   ├── db.js  config.js  seed.js  index.js
└── frontend/src/
    ├── components/  Dashboard, BondCard, BondDetail, EscrowPanel, CredentialBadge,
    │                BondAccess, RlusdPanel, AuditTrail, AgentLog, IssueBond, ui
    └── api.js  App.jsx  main.jsx
```

## Configuration (`backend/.env`)

| Var | Default | Notes |
|---|---|---|
| `PORT` | `3001` | backend port (Render injects this in production) |
| `XRPL_NODE` | `wss://s.devnet.rippletest.net:51233` | Devnet node (use `s.altnet…` for Testnet) |
| `DB_PATH` | `./greentrace.db` | SQLite file |
| `RLUSD_CURRENCY` | `524C5553…` | RLUSD currency hex |
| `RLUSD_ISSUER` | `rQhWct2fv4…` | Testnet RLUSD issuer (canonical RLUSD; proceeds use a self-issued IOU) |
| `AGENT_INTERVAL_MS` | `30000` | agent cycle cadence |
| `AGENT_START_DELAY_MS` | `120000` | grace before first auto-cycle |

## Deploy on Render

GreenTrace ships as a **single web service**: Express serves the REST/SSE API *and* the built React
SPA from one origin (no CORS, one URL). A [`render.yaml`](render.yaml) Blueprint is included.

1. Push this repo to GitHub.
2. Render → **New → Blueprint**, select the repo. Render reads `render.yaml`:
   - build: `npm install --include=dev && npm run build` (builds `frontend/dist`)
   - start: `npm start` (Express serves the API + `dist`)
   - health check: `/api/health`
3. Deploy. Open the service URL — the dashboard, API, and live agent feed all run on that one origin.

**Free-tier notes:** the filesystem is ephemeral and the service spins down when idle, so each cold
start **re-seeds on Devnet (~2 min)** — funding wallets and reissuing bonds. The server is responsive
immediately (it listens before seeding); the UI shows loading states until data arrives. No secrets
are deployed — wallet seeds are generated at runtime into the gitignored SQLite file. For instant,
persistent data, attach a Render disk and point `DB_PATH` at it (requires a paid instance).

To run the production build locally: `npm install --include=dev && npm run build && PORT=10000 npm start`,
then open `http://localhost:10000`.

## Notes

- **No seeds in source** — wallet seeds are stored only in SQLite (gitignored).
- The agent loop is graceful: if XRPL is unreachable it logs and continues; the server never crashes.
- Seeding is idempotent — restart `npm run dev` and it won't duplicate on-chain state.
- `GET /api/health` reports XRPL connectivity, domain id, RLUSD status, and wallet balances.
