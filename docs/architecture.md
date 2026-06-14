# Architecture

## Overview

GreenTrace is a two-workspace monorepo: an Express backend that owns all XRPL interaction and a
React/Vite frontend that renders the treasury dashboard. SQLite (`better-sqlite3`) is the single
source of truth for off-chain state; the XRP Ledger Testnet is the source of truth for on-chain state.

```
React (Vite, :5173)  ──HTTP/axios + SSE──▶  Express API (:3001)  ──xrpl.js v4──▶  XRPL Testnet
        │                                          │
        └── live agent feed (EventSource)          └── SQLite (better-sqlite3): wallets, bonds,
                                                       escrows, credentials, agent_logs, kv
```

## Backend layers

### `xrpl/` — feature modules (one per XLS)
- **`client.js`** — singleton `getClient()` with auto-reconnect; faucet funding; balance reads.
- **`safeSubmit.js`** — the reliability core. `submitTx(wallet, tx, {feature, allowFail})`:
  autofill → sign → `submitAndWait`; retry once on transient (`ter*`/seq/fee) codes; on hard
  failure or a disabled amendment it returns a **deterministic simulated hash** (`simulated:true`)
  so the demo always populates — unless `allowFail` is set, in which case it surfaces the real
  failure code (used to demonstrate the `tecNO_AUTH` rejection). Never throws.
- **`wallet.js`** — generate/fund/persist the 4 demo wallets (issuer, investor, verifier, buyer).
- **`iou.js`** — self-issued RLUSD test IOU used as the escrow asset (issuer flags + trustlines + funding).
- **`rlusd.js`** — real Testnet RLUSD trustlines + `payProceeds()` with IOU fallback.
- **`mpt.js`** — `issueBond` (MPTokenIssuanceCreate), `mintToInvestor`, and `buyBond` (credential-gated).
- **`escrow.js`** — `createEscrow`/`releaseEscrow` (TokenEscrow) + status with milestone accounting.
- **`credentials.js`** — issue/accept/revoke; per-bond on-chain `CredentialType` to avoid duplicate keys.
- **`domain.js`** — permissioned domain create/update; accepts `GreenBondVerified` + `InvestorKYC`.

### `agent/` — compliance engine
- **`verifier.js`** — deterministic rule checks (emissions, milestones, standard alignment, escrow
  integrity) → `COMPLIANT | AT_RISK | BREACH`. On a status change it auto-issues or revokes the green
  credential on-chain, logs to `agent_logs`, and emits a `cycle` event on a shared `EventEmitter`.
  `startAgentLoop(interval, startDelay)` runs all bonds on a cadence (first cycle delayed for demo control).
- **`mockData.js`** — hardcoded emissions/milestone inputs (bond 2 = 1200 tCO₂e, breaching its 1000 cap).

### `routes/` — REST + SSE
`wallets`, `bonds` (incl. `/:id/buy`), `escrow`, `credentials`, `agent` (incl. `/stream` SSE), `rlusd`.
Every handler is try/caught and returns JSON errors; every record carries a `simulated` flag.

### Data flow for a status change
```
agent loop ─▶ runVerificationCycle(bond)
  ├─ rule checks (mockData + DB)
  ├─ status changed? ─▶ issueCredential() / revokeBondCredential()  ──▶ XRPL (CredentialCreate/Delete)
  ├─ insertAgentLog(...)
  └─ agentBus.emit('cycle', result) ──▶ /api/agent/stream ──▶ Dashboard live feed
```

## Frontend
- `App.jsx` — sidebar + routes (Dashboard, Issue Bond, Bond Detail, Agent Log) + XRPL health dot.
- `Dashboard.jsx` — summary bar, bond grid, live SSE agent feed, 5s polling fallback.
- `BondDetail.jsx` — composes `EscrowPanel`, `CredentialBadge`, `BondAccess` (Wallet A/B demo),
  `RlusdPanel`, and `AuditTrail`.
- `ui.jsx` — shared `StatusPill`, `TxLink` (explorer links + simulated handling), `SimBadge`, etc.

## Reliability principles
- **Real-first, simulate-on-failure** — flagged in the DB and badged in the UI.
- **Idempotent seeding** — guarded by DB/kv checks; safe to restart.
- **Graceful agent** — XRPL errors are logged, never crash the server.
- **No secrets in git** — wallet seeds live only in the gitignored SQLite file.
