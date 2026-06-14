import { getClient } from './client.js';
import { submitTx } from './safeSubmit.js';
import { getWallet } from './wallet.js';
import { config, runtime } from '../config.js';
import { kvGet, kvSet, getWalletRow } from '../db.js';

const ASF_DEFAULT_RIPPLE = 8;
const ASF_ALLOW_TRUSTLINE_LOCKING = 17; // XLS-85: lets the issuer's tokens be held in escrow

/** Currency+issuer descriptor for the self-issued RLUSD test IOU. */
export function getIou() {
  return { currency: config.rlusdCurrency, issuer: runtime.iouIssuer };
}

function iouAmount(value) {
  return { currency: config.rlusdCurrency, issuer: runtime.iouIssuer, value: String(value) };
}

/**
 * Set up the self-issued RLUSD test IOU (idempotent):
 *  - issuer enables DefaultRipple + AllowTrustLineLocking
 *  - investor (and issuer-as-holder N/A) establish a trustline
 *  - issuer sends RLUSD to investor so there is real balance to escrow
 */
export async function setupIou() {
  const issuer = getWallet('issuer');
  const investor = getWallet('investor');
  runtime.iouIssuer = getWalletRow('issuer').address;

  if (kvGet('iou_ready') === '1') return getIou();

  // 1. issuer account flags
  await submitTx(issuer, { TransactionType: 'AccountSet', SetFlag: ASF_DEFAULT_RIPPLE }, { feature: 'iou-defaultripple' });
  await submitTx(issuer, { TransactionType: 'AccountSet', SetFlag: ASF_ALLOW_TRUSTLINE_LOCKING }, { feature: 'iou-locking' });

  // 2. investor trustline to RLUSD
  await submitTx(investor, {
    TransactionType: 'TrustSet',
    LimitAmount: iouAmount('10000000'),
  }, { feature: 'iou-trustset' });

  // 3. issuer funds investor with RLUSD proceeds (enough to cover all demo escrows)
  await submitTx(issuer, {
    TransactionType: 'Payment',
    Destination: investor.classicAddress,
    Amount: iouAmount('5000000'),
  }, { feature: 'iou-fund' });

  kvSet('iou_ready', '1');
  kvSet('iou_issuer', runtime.iouIssuer);
  console.log('[iou] self-issued RLUSD test IOU ready, issuer', runtime.iouIssuer);
  return getIou();
}

/** Restore runtime IOU issuer from DB (used on warm start without re-running setup). */
export function restoreIou() {
  runtime.iouIssuer = kvGet('iou_issuer') || getWalletRow('issuer')?.address || null;
}

export async function getIouBalance(address) {
  try {
    const c = await getClient();
    const lines = await c.request({ command: 'account_lines', account: address, peer: runtime.iouIssuer });
    const line = lines.result.lines.find((l) => l.currency === config.rlusdCurrency);
    return line ? line.balance : '0';
  } catch {
    return null;
  }
}

export { iouAmount };
