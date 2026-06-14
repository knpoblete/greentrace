import { Router } from 'express';
import { config } from '../config.js';
import { getAllBonds, getBond, getCredentialsByBond, getAgentLogs } from '../db.js';
import { issueBond, mintToInvestor, buyBond } from '../xrpl/mpt.js';
import { createEscrow, getEscrowStatus } from '../xrpl/escrow.js';
import { getCompletedMilestones } from '../agent/mockData.js';
import { attestBond } from '../agent/verifier.js';

const router = Router();

const txLink = (hash) => (hash ? `${config.explorerBase}${hash}` : null);

/** Assemble the full view object for a bond (status + escrow + credentials). */
export function buildBondView(bond) {
  const meta = JSON.parse(bond.metadata_json || '{}');
  const escrow = getEscrowStatus(bond.id);
  const credentials = getCredentialsByBond(bond.id).map((c) => ({
    id: c.id,
    credentialId: c.credential_id,
    type: c.credential_type,
    subject: c.subject_address,
    status: c.status,
    fields: JSON.parse(c.fields_json || '{}'),
    txHash: c.tx_hash,
    txLink: txLink(c.tx_hash),
    simulated: !!c.simulated,
    issuedAt: c.issued_at,
  }));
  const activeGreenCred = credentials.find((c) => c.type === 'GreenBondVerified' && c.status === 'ACTIVE');

  return {
    id: bond.id,
    mptIssuanceId: bond.mpt_issuance_id,
    name: bond.bond_name,
    standards: meta.standards || (bond.standard ? bond.standard.split(',') : []),
    standard: bond.standard, // joined string, back-compat
    projectType: bond.project_type,
    status: bond.status,
    greenStatus: bond.green_status,
    covenants: meta.covenants || {},
    completedMilestones: getCompletedMilestones(bond.id),
    issuerAddress: bond.issuer_address,
    verifier: meta.verifier,
    // Agent monitoring flags a pending verifier review with a recommended status (no on-chain change
    // until KPMG attests). Provenance of each figure per the plan's verification layer.
    pendingReview: !!bond.pending_review,
    recommendedStatus: bond.recommended_status || null,
    provenance: {
      greenStatus: 'verifier-attested',
      standards: 'verifier-attested',
      verifyScore: 'verifier-attested',
      credentials: 'on-chain',
      escrow: 'on-chain',
      emissions: 'self-reported',
      milestones: 'self-reported',
    },
    // Rich green-instrument metadata embedded on-chain at issuance.
    instrument: {
      isin: meta.isin || null,
      coupon: meta.coupon || null,
      maturity: meta.maturity || null,
      useOfProceeds: meta.use_of_proceeds || null,
      frameworks: meta.frameworks || [],
      verifyScore: meta.verify_score ?? null,
      issuedDate: meta.issued_date || null,
      passes: {
        ICMA: !!meta.icma_pass,
        EU_TAXONOMY: !!meta.eu_taxonomy_pass,
        EU_GREEN_BOND: !!meta.eu_green_bond_pass,
        CLIMATE_BONDS: !!meta.climate_bonds_pass,
      },
    },
    txHash: bond.tx_hash,
    txLink: txLink(bond.tx_hash),
    simulated: !!bond.simulated,
    createdAt: bond.created_at,
    escrow,
    credentials,
    // A breached bond is never "verified", even during the brief async credential-revoke window.
    verified: !!activeGreenCred && bond.green_status !== 'BREACH',
    lastChecked: getAgentLogs(50).find((l) => l.bond_id === bond.id)?.created_at || null,
  };
}

// GET /api/bonds
router.get('/', (req, res) => {
  try {
    res.json(getAllBonds().map(buildBondView));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bonds/:id  (with audit trail)
router.get('/:id', (req, res) => {
  try {
    const bond = getBond(Number(req.params.id));
    if (!bond) return res.status(404).json({ error: 'bond not found' });
    const view = buildBondView(bond);
    const logs = getAgentLogs(200).filter((l) => l.bond_id === bond.id);
    view.auditTrail = buildAuditTrail(view, logs);
    view.agentLogs = logs.map((l) => ({
      id: l.id, status: l.status, prevStatus: l.prev_status,
      findings: JSON.parse(l.findings_json || '[]'), actionTaken: l.action_taken,
      txHash: l.tx_hash, txLink: txLink(l.tx_hash), simulated: !!l.simulated, ts: l.created_at,
    }));
    res.json(view);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bonds/issue
router.post('/issue', async (req, res) => {
  try {
    const { bondName, standards, standard, projectType, covenants, maxAmount, transferFee } = req.body;
    const stds = standards ?? standard;
    if (!bondName || !stds || (Array.isArray(stds) && stds.length === 0) || !projectType) {
      return res.status(400).json({ error: 'bondName, standards (at least one), projectType are required' });
    }
    const result = await issueBond({ bondName, standards: stds, projectType, covenants, maxAmount, transferFee });
    // authorize + mint to investor (best effort)
    const mint = await mintToInvestor(result.bondId).catch(() => null);
    // Initial verifier attestation at issuance → issues the green credential on-chain.
    const attestation = await attestBond(result.bondId).catch(() => null);
    const bond = getBond(result.bondId);
    res.json({ ...result, txLink: txLink(result.txHash), mint, attestation, bond: buildBondView(bond) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bonds/:id/attest — verifier (KPMG) finalizes the agent-recommended status on-chain
router.post('/:id/attest', async (req, res) => {
  try {
    const result = await attestBond(Number(req.params.id));
    res.json({ ...result, txLink: txLink(result.txHash) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bonds/:id/buy — { role } credential-gated purchase (Wallet A accepted / Wallet B rejected)
router.post('/:id/buy', async (req, res) => {
  try {
    const { role = 'investor', amount } = req.body || {};
    const result = await buyBond(Number(req.params.id), role, amount);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bonds/:id/mint
router.post('/:id/mint', async (req, res) => {
  try {
    const { investorAddress, amount } = req.body;
    const result = await mintToInvestor(Number(req.params.id), investorAddress, amount);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function buildAuditTrail(view, logs) {
  const events = [];
  events.push({ type: 'BOND_ISSUED', label: `Bond issued (MPToken)`, txHash: view.txHash, txLink: view.txLink, simulated: view.simulated, ts: view.createdAt });
  if (view.escrow?.txHash) {
    events.push({ type: 'ESCROW_CREATE', label: `Escrow created (${view.escrow.amount} RLUSD)`, txHash: view.escrow.txHash, txLink: txLink(view.escrow.txHash), simulated: view.escrow.simulated, ts: view.createdAt });
  }
  for (const c of view.credentials) {
    events.push({ type: c.status === 'REVOKED' ? 'CREDENTIAL_REVOKED' : 'CREDENTIAL_ISSUED', label: `${c.type} ${c.status === 'REVOKED' ? 'revoked' : 'issued'}`, txHash: c.txHash, txLink: c.txLink, simulated: c.simulated, ts: c.issuedAt });
  }
  for (const l of logs) {
    if (l.action_taken && l.action_taken !== 'no change') {
      events.push({ type: 'AGENT_ACTION', label: `Agent: ${l.action_taken} (${l.status})`, txHash: l.tx_hash, txLink: txLink(l.tx_hash), simulated: !!l.simulated, ts: l.created_at });
    }
  }
  return events.sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

export default router;
