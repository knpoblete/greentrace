import Database from 'better-sqlite3';
import { config } from './config.js';

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

// Schema per spec §9, plus a `simulated` flag on on-chain-backed rows so the UI can badge
// records whose transaction fell back to a deterministic mock (amendment unavailable / submit failed).
db.exec(`
CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY,
  role TEXT UNIQUE,
  address TEXT,
  seed TEXT,
  balance TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS bonds (
  id INTEGER PRIMARY KEY,
  mpt_issuance_id TEXT UNIQUE,
  issuer_address TEXT,
  bond_name TEXT,
  standard TEXT,
  project_type TEXT,
  metadata_json TEXT,
  status TEXT DEFAULT 'ACTIVE',
  green_status TEXT DEFAULT 'COMPLIANT',
  pending_review INTEGER DEFAULT 0,
  recommended_status TEXT,
  tx_hash TEXT,
  simulated INTEGER DEFAULT 0,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS escrows (
  id INTEGER PRIMARY KEY,
  bond_id INTEGER,
  escrow_sequence INTEGER,
  owner_address TEXT,
  amount TEXT,
  currency TEXT,
  milestones_json TEXT,
  released_json TEXT DEFAULT '[]',
  status TEXT DEFAULT 'LOCKED',
  tx_hash TEXT,
  finish_after INTEGER,
  simulated INTEGER DEFAULT 0,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS credentials (
  id INTEGER PRIMARY KEY,
  credential_id TEXT UNIQUE,
  subject_address TEXT,
  bond_id INTEGER,
  credential_type TEXT,
  fields_json TEXT,
  status TEXT DEFAULT 'ACTIVE',
  tx_hash TEXT,
  simulated INTEGER DEFAULT 0,
  issued_at INTEGER,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id INTEGER PRIMARY KEY,
  bond_id INTEGER,
  bond_name TEXT,
  prev_status TEXT,
  status TEXT,
  findings_json TEXT,
  action_taken TEXT,
  tx_hash TEXT,
  simulated INTEGER DEFAULT 0,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// ---- generic key/value (domain id, iou issuer, seed marker) ----
const kvGetStmt = db.prepare('SELECT value FROM kv WHERE key = ?');
const kvSetStmt = db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
export const kvGet = (key) => kvGetStmt.get(key)?.value ?? null;
export const kvSet = (key, value) => kvSetStmt.run(key, String(value));

// ---- wallets ----
const insertWalletStmt = db.prepare(
  'INSERT INTO wallets (role, address, seed, balance, created_at) VALUES (@role, @address, @seed, @balance, @created_at) ' +
  'ON CONFLICT(role) DO UPDATE SET address=excluded.address, seed=excluded.seed, balance=excluded.balance'
);
export const upsertWallet = (w) => insertWalletStmt.run({ created_at: Date.now(), ...w });
export const getWalletRow = (role) => db.prepare('SELECT * FROM wallets WHERE role = ?').get(role);
export const getAllWallets = () => db.prepare('SELECT * FROM wallets ORDER BY id').all();
export const updateWalletBalance = (role, balance) =>
  db.prepare('UPDATE wallets SET balance = ? WHERE role = ?').run(balance, role);

// ---- bonds ----
const insertBondStmt = db.prepare(`
  INSERT INTO bonds (mpt_issuance_id, issuer_address, bond_name, standard, project_type,
    metadata_json, status, green_status, tx_hash, simulated, created_at)
  VALUES (@mpt_issuance_id, @issuer_address, @bond_name, @standard, @project_type,
    @metadata_json, @status, @green_status, @tx_hash, @simulated, @created_at)
`);
export const insertBond = (b) =>
  insertBondStmt.run({ status: 'ACTIVE', green_status: 'COMPLIANT', simulated: 0, created_at: Date.now(), ...b }).lastInsertRowid;
export const getBond = (id) => db.prepare('SELECT * FROM bonds WHERE id = ?').get(id);
export const getAllBonds = () => db.prepare('SELECT * FROM bonds ORDER BY id').all();
export const updateBondStatus = (id, green_status) =>
  db.prepare('UPDATE bonds SET green_status = ? WHERE id = ?').run(green_status, id);
// Agent monitoring flags a pending review + recommended status; the verifier finalizes it.
export const setBondReview = (id, pending_review, recommended_status) =>
  db.prepare('UPDATE bonds SET pending_review = ?, recommended_status = ? WHERE id = ?')
    .run(pending_review ? 1 : 0, recommended_status ?? null, id);
export const countBonds = () => db.prepare('SELECT COUNT(*) c FROM bonds').get().c;

// ---- escrows ----
const insertEscrowStmt = db.prepare(`
  INSERT INTO escrows (bond_id, escrow_sequence, owner_address, amount, currency, milestones_json,
    released_json, status, tx_hash, finish_after, simulated, created_at)
  VALUES (@bond_id, @escrow_sequence, @owner_address, @amount, @currency, @milestones_json,
    @released_json, @status, @tx_hash, @finish_after, @simulated, @created_at)
`);
export const insertEscrow = (e) =>
  insertEscrowStmt.run({ released_json: '[]', status: 'LOCKED', simulated: 0, created_at: Date.now(), ...e }).lastInsertRowid;
export const getEscrowByBond = (bondId) => db.prepare('SELECT * FROM escrows WHERE bond_id = ?').get(bondId);
export const getEscrow = (id) => db.prepare('SELECT * FROM escrows WHERE id = ?').get(id);
export const updateEscrow = (id, fields) => {
  const keys = Object.keys(fields);
  const set = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE escrows SET ${set} WHERE id = @id`).run({ id, ...fields });
};

// ---- credentials ----
const insertCredentialStmt = db.prepare(`
  INSERT INTO credentials (credential_id, subject_address, bond_id, credential_type, fields_json,
    status, tx_hash, simulated, issued_at, expires_at)
  VALUES (@credential_id, @subject_address, @bond_id, @credential_type, @fields_json,
    @status, @tx_hash, @simulated, @issued_at, @expires_at)
`);
export const insertCredential = (c) =>
  insertCredentialStmt.run({ status: 'ACTIVE', simulated: 0, issued_at: Date.now(), expires_at: null, ...c }).lastInsertRowid;
export const getCredentialsBySubject = (address) =>
  db.prepare('SELECT * FROM credentials WHERE subject_address = ? ORDER BY id DESC').all(address);
export const getCredentialsByBond = (bondId) =>
  db.prepare('SELECT * FROM credentials WHERE bond_id = ? ORDER BY id DESC').all(bondId);
export const getCredential = (id) => db.prepare('SELECT * FROM credentials WHERE id = ?').get(id);
export const getActiveCredentialForBond = (bondId, type) =>
  db.prepare("SELECT * FROM credentials WHERE bond_id = ? AND credential_type = ? AND status = 'ACTIVE' ORDER BY id DESC").get(bondId, type);
export const updateCredentialStatus = (id, status, txHash) =>
  db.prepare('UPDATE credentials SET status = ?, tx_hash = COALESCE(?, tx_hash) WHERE id = ?').run(status, txHash, id);

// ---- agent logs ----
const insertAgentLogStmt = db.prepare(`
  INSERT INTO agent_logs (bond_id, bond_name, prev_status, status, findings_json, action_taken,
    tx_hash, simulated, created_at)
  VALUES (@bond_id, @bond_name, @prev_status, @status, @findings_json, @action_taken,
    @tx_hash, @simulated, @created_at)
`);
export const insertAgentLog = (l) =>
  insertAgentLogStmt.run({ tx_hash: null, simulated: 0, created_at: Date.now(), ...l }).lastInsertRowid;
export const getAgentLogs = (limit = 50) =>
  db.prepare('SELECT * FROM agent_logs ORDER BY id DESC LIMIT ?').all(limit);

export default db;
