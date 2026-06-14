import { EventEmitter } from 'node:events';
import {
  getAllBonds, getBond, updateBondStatus, setBondReview, insertAgentLog,
  getActiveCredentialForBond,
} from '../db.js';
import { getEscrowByBond } from '../db.js';
import { getMockEmissions, getCompletedMilestones } from './mockData.js';
import { issueCredential, revokeBondCredential } from '../xrpl/credentials.js';
import { labelFor, projectTypesFor, CORE_STANDARDS } from '../standards.js';

// Shared bus so the SSE route can stream live agent events to the frontend.
export const agentBus = new EventEmitter();

const REQUIRED_MILESTONES = ['planning', 'construction', 'reporting'];

// ---- individual rule checks ----

export function checkEmissionsCompliance(bond, meta) {
  const cap = meta.covenants?.maxEmissions;
  const actual = getMockEmissions(bond.id);
  const pass = cap == null || actual <= cap;
  return {
    rule: 'emissions',
    pass,
    detail: cap == null ? 'no emissions covenant' : `${actual} / ${cap} tCO2e`,
    severity: pass ? 'ok' : 'breach',
  };
}

export function checkMilestoneProgress(bond, meta) {
  const planned = meta.covenants?.milestones || REQUIRED_MILESTONES;
  const done = getCompletedMilestones(bond.id);
  const pending = planned.filter((m) => !done.includes(m));
  return {
    rule: 'milestones',
    pass: pending.length < planned.length, // some progress made
    detail: `${done.length}/${planned.length} complete (${done.join(', ') || 'none'})`,
    severity: done.length === 0 ? 'risk' : 'ok',
  };
}

export function checkCoreStandards(bond, meta) {
  // Business-plan rule: a bond must pass ALL THREE core standards (ICMA, EU Taxonomy, Climate Bonds)
  // to hold green status. A core standard passes if the bond claims it AND its project type aligns.
  const claimed = meta.standards || (meta.standard ? [meta.standard] : []);
  const failing = CORE_STANDARDS.filter((code) => {
    const aligned = projectTypesFor(code).includes(meta.projectType);
    return !(claimed.includes(code) && aligned);
  });
  const pass = failing.length === 0;
  return {
    rule: 'standards',
    pass,
    detail: pass
      ? `passes all 3 core standards (${CORE_STANDARDS.map(labelFor).join(', ')})`
      : `fails: ${failing.map(labelFor).join(', ')}`,
    severity: pass ? 'ok' : 'risk',
  };
}

export function checkEscrowIntegrity(bond) {
  const escrow = getEscrowByBond(bond.id);
  if (!escrow) return { rule: 'escrow', pass: true, detail: 'no escrow', severity: 'ok' };
  const diverted = escrow.status === 'DIVERTED';
  return {
    rule: 'escrow',
    pass: !diverted,
    detail: diverted ? 'proceeds diverted' : `proceeds intact (${escrow.status})`,
    severity: diverted ? 'breach' : 'ok',
  };
}

function deriveStatus(findings) {
  if (findings.some((f) => f.severity === 'breach' && !f.pass)) return 'BREACH';
  if (findings.some((f) => f.severity === 'risk' && !f.pass)) return 'AT_RISK';
  if (findings.some((f) => !f.pass)) return 'AT_RISK';
  return 'COMPLIANT';
}

function recommend(status, findings) {
  if (status === 'BREACH') {
    const f = findings.find((x) => !x.pass && x.severity === 'breach');
    return `Recommend revoking green credential — ${f?.rule} failed (${f?.detail}). Awaiting verifier attestation.`;
  }
  if (status === 'AT_RISK') return 'Recommend review — a covenant/standard is failing. Awaiting verifier attestation.';
  return 'No action — bond remains compliant.';
}

/**
 * MONITOR-ONLY verification cycle (business-plan governance: the agent never finalises a status
 * change or moves funds). It evaluates the rules, and if its assessment differs from the bond's
 * current attested status it flags the bond for verifier review with a recommended status — it does
 * NOT touch the credential or the official green_status. A credentialed reviewer (KPMG) finalizes
 * via attestBond(). Logs the cycle and emits an SSE event.
 */
export async function runVerificationCycle(bondId) {
  const bond = getBond(bondId);
  if (!bond) return null;
  const meta = JSON.parse(bond.metadata_json || '{}');

  const findings = [
    checkEmissionsCompliance(bond, meta),
    checkMilestoneProgress(bond, meta),
    checkCoreStandards(bond, meta),
    checkEscrowIntegrity(bond),
  ];
  const assessed = deriveStatus(findings);
  const currentStatus = bond.green_status;
  const recommendedAction = recommend(assessed, findings);
  const needsReview = assessed !== currentStatus;

  setBondReview(bondId, needsReview, needsReview ? assessed : null);
  const actionTaken = needsReview
    ? `flagged for verifier review — recommend ${assessed}`
    : 'no change';

  const result = {
    bondId,
    bondName: bond.bond_name,
    prevStatus: currentStatus,
    status: currentStatus,          // unchanged — agent does not finalise
    assessed,                       // the agent's monitored assessment
    recommended: needsReview ? assessed : null,
    pendingReview: needsReview,
    findings,
    recommendedAction,
    actionTaken,
    txHash: null,                   // agent takes no on-chain action
    simulated: false,
    source: 'agent-monitor',
    ts: Date.now(),
  };

  insertAgentLog({
    bond_id: bondId,
    bond_name: bond.bond_name,
    prev_status: currentStatus,
    status: currentStatus,
    findings_json: JSON.stringify(findings),
    action_taken: actionTaken,
    tx_hash: null,
    simulated: 0,
  });

  agentBus.emit('cycle', result);
  return result;
}

/**
 * Verifier (KPMG) attestation — the human/credentialed step that FINALISES a status change on-chain.
 * Applies the bond's recommended status: issues the green credential when COMPLIANT, or revokes it
 * otherwise. Clears the review flag. This is the only path that mutates the credential / green_status.
 */
export async function attestBond(bondId) {
  const bond = getBond(bondId);
  if (!bond) throw new Error(`bond ${bondId} not found`);
  const meta = JSON.parse(bond.metadata_json || '{}');
  const prevStatus = bond.green_status;
  const target = bond.recommended_status || bond.green_status;

  let actionTaken;
  let txHash = null;
  let simulated = false;

  try {
    if (target === 'COMPLIANT') {
      const existing = getActiveCredentialForBond(bondId, 'GreenBondVerified');
      if (!existing) {
        const cred = await issueCredential({
          subjectAddress: bond.issuer_address,
          credentialType: 'GreenBondVerified',
          bondId,
          fields: { standards: meta.standards || [meta.standard], covenantStatus: 'COMPLIANT' },
        });
        actionTaken = 'KPMG attested COMPLIANT — credential issued';
        txHash = cred.txHash;
        simulated = cred.simulated;
      } else {
        actionTaken = 'KPMG attested COMPLIANT — credential current';
      }
    } else {
      const revoked = await revokeBondCredential(bondId, 'GreenBondVerified');
      if (revoked) {
        actionTaken = `KPMG attested ${target} — credential revoked`;
        txHash = revoked.txHash;
        simulated = revoked.simulated;
      } else {
        actionTaken = `KPMG attested ${target}`;
      }
    }
  } catch (err) {
    console.warn('[attest] credential action failed:', err?.message);
    actionTaken = `KPMG attested ${target} (credential action error)`;
  }

  updateBondStatus(bondId, target);
  setBondReview(bondId, false, null);

  const result = {
    bondId,
    bondName: bond.bond_name,
    prevStatus,
    status: target,
    actionTaken,
    txHash,
    simulated,
    source: 'verifier-attested',
    ts: Date.now(),
  };

  insertAgentLog({
    bond_id: bondId,
    bond_name: bond.bond_name,
    prev_status: prevStatus,
    status: target,
    findings_json: JSON.stringify([{ rule: 'attestation', pass: target === 'COMPLIANT', detail: actionTaken, severity: target === 'COMPLIANT' ? 'ok' : 'breach' }]),
    action_taken: actionTaken,
    tx_hash: txHash,
    simulated: simulated ? 1 : 0,
  });

  agentBus.emit('cycle', result);
  return result;
}

/** Run a cycle across all active bonds. */
export async function runAllBonds() {
  const results = [];
  for (const bond of getAllBonds()) {
    if (bond.status !== 'ACTIVE') continue;
    results.push(await runVerificationCycle(bond.id));
  }
  agentBus.emit('cycleComplete', { ts: Date.now(), count: results.length });
  return results;
}

let timer = null;
let startDelayTimer = null;

/**
 * Start the periodic verification loop. The first automatic cycle waits `startDelayMs`
 * (so the live "Run Now" demo flip stays in the operator's control), then it runs every
 * `intervalMs`. Never throws; logs and continues on error.
 */
export function startAgentLoop(intervalMs = 30000, startDelayMs = 0) {
  if (timer || startDelayTimer) return;
  const begin = () => {
    console.log(`[agent] loop running, interval ${intervalMs}ms`);
    timer = setInterval(() => {
      runAllBonds().catch((err) => console.warn('[agent] cycle error:', err?.message));
    }, intervalMs);
    timer.unref?.();
  };
  if (startDelayMs > 0) {
    console.log(`[agent] loop armed, first auto-cycle in ${startDelayMs}ms (use "Run Now" to trigger sooner)`);
    startDelayTimer = setTimeout(begin, startDelayMs);
    startDelayTimer.unref?.();
  } else {
    begin();
  }
}

export function stopAgentLoop() {
  if (timer) { clearInterval(timer); timer = null; }
  if (startDelayTimer) { clearTimeout(startDelayTimer); startDelayTimer = null; }
}
