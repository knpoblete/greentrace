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

A local, deterministic **rule-based compliance agent** (no external AI API) continuously **monitors**
every bond and **flags** changes for review. Per the business-plan governance model, the agent never
finalises a status change itself — a credentialed reviewer (**KPMG**) attests it on-chain (issuing or
revoking the green credential). **Green status rule:** COMPLIANT only if the bond passes all three
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

1. **Dashboard** — 3 bonds, all COMPLIANT and KPMG-credentialed; live agent feed on the right.
2. **Click "Run Agent Now"** — the monitoring agent detects Coastal Wind's emissions breach
   (1200 > 1000 tCO₂e) and **flags it for verifier review** (recommend BREACH). The status and
   credential are **not** changed — the agent never acts on-chain.
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
| `PORT` | `3001` | backend port |
| `XRPL_NODE` | `wss://s.altnet.rippletest.net:51233` | Testnet node |
| `DB_PATH` | `./greentrace.db` | SQLite file |
| `RLUSD_CURRENCY` | `524C5553…` | RLUSD currency hex |
| `RLUSD_ISSUER` | `rQhWct2fv4…` | Testnet RLUSD issuer |
| `AGENT_INTERVAL_MS` | `30000` | agent cycle cadence |
| `AGENT_START_DELAY_MS` | `120000` | grace before first auto-cycle |

## Notes

- **No seeds in source** — wallet seeds are stored only in SQLite (gitignored).
- The agent loop is graceful: if XRPL is unreachable it logs and continues; the server never crashes.
- Seeding is idempotent — restart `npm run dev` and it won't duplicate on-chain state.
- `GET /api/health` reports XRPL connectivity, domain id, RLUSD status, and wallet balances.
