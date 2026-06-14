# GreenTrace — Full-Stack Build Spec
> Feed this file to Claude Code in VS Code. No Anthropic API key required. All AI/agent logic is simulated with deterministic mocks for demo purposes.

---

## Project Overview

GreenTrace is a real-time green bond verification and issuance platform built natively on XRPL Testnet. It combines MPTokens (XLS-33), TokenEscrow (XLS-85), Credentials (XLS-70), and Permissioned Domains (XLS-80) to give treasury professionals a single dashboard showing the live green compliance status of every bond they hold or have issued.

**Hackathon track:** XRPL multi-feature integration  
**Network:** XRPL Testnet  
**Stablecoin:** RLUSD (Testnet)  
**No external AI API required** — agent logic is a local rule-based simulation

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| XRPL | xrpl.js (v3.x) |
| Database | SQLite via better-sqlite3 (local, zero-config) |
| Wallet | Local keypair generation (testnet only) |
| Agent | Local rule-based engine (no external API) |

---

## Repository Structure

```
greentrace/
├── README.md
├── package.json                  # root (workspaces)
├── .env.example
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── index.js              # Express entry point
│   │   ├── db.js                 # SQLite setup + seed
│   │   ├── xrpl/
│   │   │   ├── client.js         # XRPL Testnet connection
│   │   │   ├── wallet.js         # Wallet generation + funding
│   │   │   ├── mpt.js            # MPToken issuance (XLS-33)
│   │   │   ├── escrow.js         # TokenEscrow flows (XLS-85)
│   │   │   ├── credentials.js    # Credential issuance (XLS-70)
│   │   │   └── domain.js         # Permissioned domain setup (XLS-80)
│   │   ├── agent/
│   │   │   └── verifier.js       # Local rule-based compliance agent
│   │   └── routes/
│   │       ├── bonds.js
│   │       ├── wallets.js
│   │       ├── credentials.js
│   │       └── agent.js
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js                # Axios wrappers for backend
│       ├── components/
│       │   ├── Dashboard.jsx     # Main treasury view
│       │   ├── BondCard.jsx      # Per-bond status card
│       │   ├── IssueBond.jsx     # Bond issuance form
│       │   ├── EscrowPanel.jsx   # Escrow status + release
│       │   ├── CredentialBadge.jsx
│       │   ├── AgentLog.jsx      # Simulated agent activity feed
│       │   └── AuditTrail.jsx    # Full on-chain audit history
│       └── styles/
│           └── index.css
└── docs/
    ├── architecture.md
    └── xrpl-transactions.md
```

---

## Environment Variables

Create `.env` in `/backend`:

```env
PORT=3001
XRPL_NODE=wss://s.altnet.rippletest.net:51233
RLUSD_ISSUER=rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh   # testnet RLUSD issuer
RLUSD_CURRENCY=524C555344000000000000000000000000000000   # hex for RLUSD
DB_PATH=./greentrace.db
```

---

## Backend Specification

### 1. XRPL Client (`xrpl/client.js`)

- Connect to XRPL Testnet via WebSocket using `xrpl.Client`
- Export a singleton `getClient()` that auto-reconnects
- Export `fundWallet(wallet)` using the testnet faucet

### 2. Wallet Management (`xrpl/wallet.js`)

- `generateWallet()` — creates a new `xrpl.Wallet`, funds via faucet, stores in SQLite
- `getWallet(role)` — retrieves stored wallet by role: `issuer | investor | verifier`
- On first run, auto-generate and fund three demo wallets (issuer, investor, verifier)
- Store: `{ role, address, seed, balance }` in `wallets` table

### 3. MPToken Bond Issuance (`xrpl/mpt.js`)

Implements XLS-33 MPToken flow:

**`issueBond(params)`**
- Submits `MPTokenIssuanceCreate` transaction from issuer wallet
- `params`: `{ bondName, standard, projectType, covenants, maxAmount, transferFee }`
- Embed green metadata in `MPTokenMetadata` field as hex-encoded JSON:
  ```json
  {
    "name": "...",
    "standard": "EU_GREEN_BOND | EU_TAXONOMY | ICMA",
    "projectType": "USE_OF_PROCEEDS | GREEN_REVENUE | PROJECT | EU_GREEN",
    "covenants": { "maxEmissions": 1000, "milestones": ["planning", "construction", "reporting"] },
    "issuedAt": 1234567890,
    "verifier": "rXXX..."
  }
  ```
- Set `requireAuth: true` on the issuance
- Store result in `bonds` table: `{ mptIssuanceId, issuerAddress, metadata, status, txHash }`

**`mintToInvestor(mptIssuanceId, investorAddress, amount)`**
- Submits `MPTokenIssuanceSet` to authorize investor
- Then investor submits `MPTokenCreate` to hold the token

### 4. TokenEscrow (`xrpl/escrow.js`)

Implements XLS-85 TokenEscrow for RLUSD proceeds:

**`createEscrow(params)`**
- `params`: `{ issuerWallet, amount, milestones, mptIssuanceId }`
- Submits `EscrowCreate` with RLUSD IOU amount
- Condition: time-based (`FinishAfter`) for demo; note in production this would be oracle-conditional
- Stores escrow sequence + bond link in `escrows` table

**`releaseEscrow(escrowId, milestone)`**
- Validates milestone is met (checked against agent state)
- Submits `EscrowFinish`
- Updates bond record: proceeds released, milestone logged

**`getEscrowStatus(bondId)`**
- Returns: `{ totalLocked, released, pendingMilestones, completedMilestones }`

### 5. Credentials (`xrpl/credentials.js`)

Implements XLS-70 on-chain credentials:

**`issueCredential(params)`**
- `params`: `{ verifierWallet, subjectAddress, credentialType, fields }`
- Submits `CredentialCreate` transaction
- `credentialType`: `"GreenBondVerified" | "InvestorKYC" | "MilestoneComplete"`
- `fields` (in CredentialDocument as hex JSON):
  ```json
  {
    "standard": "EU_GREEN_BOND",
    "verifiedAt": 1234567890,
    "expiresAt": 1234567890,
    "covenantStatus": "COMPLIANT",
    "verifierName": "GreenTrace Demo Verifier"
  }
  ```
- Store in `credentials` table: `{ credentialId, subject, type, fields, txHash, issuedAt }`

**`revokeCredential(credentialId)`**
- Submits `CredentialDelete`
- Updates record status to `REVOKED`

**`getCredentials(address)`**
- Returns all active credentials for a wallet address

### 6. Permissioned Domain (`xrpl/domain.js`)

Implements XLS-80 permissioned domains:

**`setupDomain()`**
- On startup, issuer wallet submits `DomainCreate`
- Domain includes issuer, investor, verifier wallet addresses
- Store domain ID in config

**`addToDomain(walletAddress)`**
- Submits `DomainAddMember`

**`getDomainMembers()`**
- Returns list of credentialed members in the domain

### 7. Compliance Agent (`agent/verifier.js`)

**No external API.** Deterministic rule-based engine simulating automated verification.

**`runVerificationCycle(bondId)`**
- Loads bond metadata + covenants from DB
- Runs rule checks:
  - `checkEmissionsCompliance(bond)` — compares mock emissions data against `maxEmissions` covenant
  - `checkMilestoneProgress(bond)` — checks which milestones are marked complete
  - `checkStandardAlignment(bond)` — validates bond type against standard requirements
  - `checkEscrowIntegrity(bond)` — confirms proceeds haven't been diverted
- Returns: `{ status: "COMPLIANT" | "AT_RISK" | "BREACH", findings: [...], recommendedAction }`
- If status changes, automatically calls `issueCredential()` or `revokeCredential()`
- Logs each cycle to `agent_logs` table

**`startAgentLoop(intervalMs = 30000)`**
- Runs `runVerificationCycle` on all active bonds every 30 seconds
- Emits results via Server-Sent Events (SSE) to frontend

**Mock data inputs** (hardcoded in agent, no external calls):
```js
const MOCK_EMISSIONS = { bond1: 850, bond2: 1200 }  // bond2 breaches covenant of 1000
const MOCK_MILESTONES = { bond1: ["planning", "construction"], bond2: ["planning"] }
```

### 8. REST API Routes

**`/api/wallets`**
- `GET /api/wallets` — return all demo wallets (address only, no seeds)
- `POST /api/wallets/fund` — trigger faucet fund for a wallet

**`/api/bonds`**
- `GET /api/bonds` — list all bonds with current status + credential state
- `POST /api/bonds/issue` — issue new MPToken bond
- `GET /api/bonds/:id` — single bond detail with full audit trail
- `POST /api/bonds/:id/mint` — mint bond tokens to investor

**`/api/escrow`**
- `GET /api/escrow/:bondId` — escrow status for a bond
- `POST /api/escrow/create` — create escrow for a bond
- `POST /api/escrow/release` — release escrow on milestone completion

**`/api/credentials`**
- `GET /api/credentials/:address` — credentials for a wallet
- `POST /api/credentials/issue` — manually trigger credential issuance
- `DELETE /api/credentials/:id` — revoke credential

**`/api/agent`**
- `GET /api/agent/logs` — last 50 agent log entries
- `POST /api/agent/run` — manually trigger a verification cycle
- `GET /api/agent/stream` — SSE endpoint for live agent updates

### 9. SQLite Schema

```sql
CREATE TABLE wallets (
  id INTEGER PRIMARY KEY,
  role TEXT UNIQUE,
  address TEXT,
  seed TEXT,
  balance TEXT,
  created_at INTEGER
);

CREATE TABLE bonds (
  id INTEGER PRIMARY KEY,
  mpt_issuance_id TEXT UNIQUE,
  issuer_address TEXT,
  bond_name TEXT,
  standard TEXT,
  project_type TEXT,
  metadata_json TEXT,
  status TEXT DEFAULT 'ACTIVE',
  green_status TEXT DEFAULT 'COMPLIANT',
  tx_hash TEXT,
  created_at INTEGER
);

CREATE TABLE escrows (
  id INTEGER PRIMARY KEY,
  bond_id INTEGER,
  escrow_sequence INTEGER,
  amount TEXT,
  currency TEXT,
  milestones_json TEXT,
  status TEXT DEFAULT 'LOCKED',
  tx_hash TEXT,
  created_at INTEGER
);

CREATE TABLE credentials (
  id INTEGER PRIMARY KEY,
  credential_id TEXT UNIQUE,
  subject_address TEXT,
  bond_id INTEGER,
  credential_type TEXT,
  fields_json TEXT,
  status TEXT DEFAULT 'ACTIVE',
  tx_hash TEXT,
  issued_at INTEGER,
  expires_at INTEGER
);

CREATE TABLE agent_logs (
  id INTEGER PRIMARY KEY,
  bond_id INTEGER,
  status TEXT,
  findings_json TEXT,
  action_taken TEXT,
  tx_hash TEXT,
  created_at INTEGER
);
```

---

## Frontend Specification

### Design Direction
- Dark theme: background `#0a0f1e`, card surface `#111827`
- Accent: green `#10b981` for compliant, amber `#f59e0b` for at-risk, red `#ef4444` for breach
- Font: Inter (Google Fonts)
- Sidebar navigation + main content area
- All data live-refreshed via polling (5s) or SSE

### Pages / Views

#### 1. Dashboard (`Dashboard.jsx`)
The main treasury overview. Shows:
- **Summary bar**: total bonds, total RLUSD in escrow, bonds at risk, last agent run timestamp
- **Bond grid**: one `BondCard` per bond
- **Agent activity feed** (right sidebar): last 10 agent log entries, live via SSE

#### 2. Bond Card (`BondCard.jsx`)
Per-bond status card showing:
- Bond name + standard badge (EU GREEN BOND / EU TAXONOMY / ICMA)
- **Green status pill**: COMPLIANT (green) / AT RISK (amber) / BREACH (red)
- Project type
- Escrow status: `X RLUSD locked | Y released`
- Credential badge: verified by / last checked timestamp
- Covenant compliance mini-list (each covenant with pass/fail icon)
- "View Detail" button → bond detail page
- XRPL transaction hash links (link to `https://testnet.xrpl.org/transactions/{txHash}`)

#### 3. Issue Bond Form (`IssueBond.jsx`)
Step-by-step form:
- Step 1: Bond basics (name, standard, project type)
- Step 2: Covenant terms (max emissions, milestone list)
- Step 3: Escrow setup (RLUSD amount, milestone release schedule)
- Step 4: Review + submit
- On submit: calls `POST /api/bonds/issue` then `POST /api/escrow/create`
- Shows transaction hash + XRPL explorer link on success

#### 4. Bond Detail Page
Full view for a single bond:
- All card info expanded
- **Escrow panel** (`EscrowPanel.jsx`): milestones with complete/incomplete status, "Release Funds" button per milestone
- **Credentials panel** (`CredentialBadge.jsx`): all credentials on this bond, issuer/investor wallet credentials
- **Audit trail** (`AuditTrail.jsx`): chronological list of every on-chain event (issuance, escrow create, credential issue/revoke, agent actions) with tx hashes

#### 5. Agent Log (`AgentLog.jsx`)
- Full log of agent verification cycles
- Each entry: timestamp, bond name, previous status → new status, findings list, action taken (credential issued/revoked/no change)
- Color-coded by outcome

### API Client (`api.js`)
Use Axios with base URL `http://localhost:3001`. Export named functions:
```js
export const getBonds = () => axios.get('/api/bonds')
export const issueBond = (data) => axios.post('/api/bonds/issue', data)
export const getCredentials = (address) => axios.get(`/api/credentials/${address}`)
export const getAgentLogs = () => axios.get('/api/agent/logs')
export const triggerAgent = () => axios.post('/api/agent/run')
// SSE
export const subscribeAgentStream = (onMessage) => {
  const es = new EventSource('http://localhost:3001/api/agent/stream')
  es.onmessage = (e) => onMessage(JSON.parse(e.data))
  return es
}
```

---

## Demo Flow (What the Judge Sees)

1. **Load dashboard** — three pre-seeded bonds visible, two COMPLIANT, one AT RISK
2. **Click agent "Run Now"** — agent cycles, bond2 breaches emissions covenant, status flips to BREACH, credential auto-revoked, shown live in feed
3. **Click bond2** — see the revoked credential, the failing covenant, the escrow still locked
4. **Issue new bond** — walk through form, submit, see MPToken tx hash appear, escrow created, credential issued, bond appears on dashboard as COMPLIANT
5. **Release a milestone** — click "Release Funds" on a completed milestone, see RLUSD escrow release tx hash
6. **All tx hashes** link to `testnet.xrpl.org` — on-chain proof for judges

---

## Seed Data (Auto-run on First Start)

On `npm run dev` with empty DB, backend should:
1. Generate + fund 3 testnet wallets (issuer, investor, verifier)
2. Setup permissioned domain
3. Issue 3 demo bonds on-chain with varying covenant states
4. Create escrows for each
5. Issue credentials for bonds 1 and 2 (bond 2 will be revoked by first agent cycle)
6. Run first agent cycle

This means the demo is fully live with real testnet transactions from the first page load.

---

## XRPL Feature Map (for Documentation)

| Feature | XLS | Used For |
|---|---|---|
| MPTokens | XLS-33 | Bond token issuance with embedded green metadata |
| TokenEscrow | XLS-85 | Locking RLUSD proceeds until milestones met |
| Credentials | XLS-70 | On-chain green verification badges, auto-updated |
| Permissioned Domain | XLS-80 | Compliance boundary for issuer/investor/verifier |
| RLUSD | — | Stablecoin for escrow proceeds |

---

## Notes for Claude Code

- Use `xrpl.js` v3 — check the npm registry for latest testnet-compatible version
- All XRPL transactions should be wrapped in try/catch with meaningful error messages returned to frontend
- If a testnet transaction fails due to fee or sequence issues, retry once with updated account sequence
- The agent loop should be graceful — if XRPL is unreachable, log and continue; never crash the server
- All seed data generation should be idempotent — check DB before submitting on-chain transactions
- Frontend should handle loading and error states on every API call
- Do not hardcode seeds in source — store in SQLite only, excluded from git via `.gitignore`
- Add a `GET /api/health` endpoint that returns XRPL connection status + wallet balances
