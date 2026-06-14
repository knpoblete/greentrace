import { unixTimeToRippleTime } from 'xrpl';
import { submitTx } from './safeSubmit.js';
import { getWallet } from './wallet.js';
import { iouAmount, getIou } from './iou.js';
import { config } from '../config.js';
import {
  insertEscrow, getEscrowByBond, getEscrow, updateEscrow, getWalletRow,
} from '../db.js';
import { isMilestoneComplete } from '../agent/mockData.js';

/**
 * Create a token escrow (XLS-85) locking RLUSD proceeds.
 * Owner = investor (holds the RLUSD); Destination = issuer. Time-based FinishAfter so the
 * "Release Funds" action can finish it; milestone gating is enforced in releaseEscrow().
 * params: { amount, milestones, bondId }
 */
export async function createEscrow(params) {
  const investor = getWallet('investor');
  const issuerRow = getWalletRow('issuer');
  const { currency } = getIou();

  // FinishAfter a few seconds out so EscrowFinish is valid as soon as a milestone is released.
  const finishAfter = unixTimeToRippleTime(Date.now() + 2000);

  const res = await submitTx(investor, {
    TransactionType: 'EscrowCreate',
    Amount: iouAmount(params.amount),
    Destination: issuerRow.address,
    FinishAfter: finishAfter,
  }, { feature: 'escrow-create', simKey: `escrow:${params.bondId}` });

  const sequence = res.result?.Sequence ?? res.result?.tx_json?.Sequence ?? Math.floor(Math.random() * 1e6);

  const escrowId = insertEscrow({
    bond_id: params.bondId,
    escrow_sequence: sequence,
    owner_address: investor.classicAddress,
    amount: String(params.amount),
    currency,
    milestones_json: JSON.stringify(params.milestones || []),
    released_json: '[]',
    tx_hash: res.hash,
    finish_after: finishAfter,
    simulated: res.simulated ? 1 : 0,
  });

  return { escrowId, sequence, txHash: res.hash, simulated: res.simulated };
}

/**
 * Release escrowed proceeds for a milestone via EscrowFinish.
 * Validates the milestone is actually complete (agent state) before finishing.
 */
export async function releaseEscrow(bondId, milestone) {
  const escrow = getEscrowByBond(bondId);
  if (!escrow) throw new Error(`no escrow for bond ${bondId}`);

  if (!isMilestoneComplete(bondId, milestone)) {
    return { released: false, reason: `milestone "${milestone}" is not complete`, txHash: null };
  }
  const already = JSON.parse(escrow.released_json || '[]');
  if (already.includes(milestone)) {
    return { released: false, reason: `milestone "${milestone}" already released`, txHash: null };
  }

  const finisher = getWallet('issuer'); // destination/issuer finishes the escrow
  const res = await submitTx(finisher, {
    TransactionType: 'EscrowFinish',
    Owner: escrow.owner_address,
    OfferSequence: escrow.escrow_sequence,
  }, { feature: 'escrow-finish', simKey: `escrow-finish:${bondId}:${milestone}` });

  const released = [...already, milestone];
  const allMilestones = JSON.parse(escrow.milestones_json || '[]');
  updateEscrow(escrow.id, {
    released_json: JSON.stringify(released),
    status: released.length >= allMilestones.length && allMilestones.length > 0 ? 'RELEASED' : 'PARTIAL',
    simulated: res.simulated ? 1 : escrow.simulated,
  });

  return { released: true, milestone, txHash: res.hash, simulated: res.simulated };
}

export function getEscrowStatus(bondId) {
  const escrow = getEscrowByBond(bondId);
  if (!escrow) {
    return { totalLocked: '0', released: '0', pendingMilestones: [], completedMilestones: [], currency: config.rlusdCurrency };
  }
  const milestones = JSON.parse(escrow.milestones_json || '[]');
  const releasedMs = JSON.parse(escrow.released_json || '[]');
  const total = Number(escrow.amount);
  const perMilestone = milestones.length ? total / milestones.length : 0;
  const releasedAmt = perMilestone * releasedMs.length;

  return {
    escrowId: escrow.id,
    status: escrow.status,
    totalLocked: String(total - releasedAmt),
    released: String(releasedAmt),
    amount: escrow.amount,
    currency: escrow.currency,
    pendingMilestones: milestones.filter((m) => !releasedMs.includes(m)),
    completedMilestones: releasedMs,
    allMilestones: milestones,
    txHash: escrow.tx_hash,
    simulated: !!escrow.simulated,
  };
}
