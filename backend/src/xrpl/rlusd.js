import { getClient } from './client.js';
import { submitTx } from './safeSubmit.js';
import { getWallet } from './wallet.js';
import { iouAmount } from './iou.js';
import { config } from '../config.js';
import { kvGet, kvSet, getWalletRow } from '../db.js';

const ISSUER = config.rlusdIssuer;
const CURRENCY = config.rlusdCurrency;

export function rlusdAmount(value) {
  return { currency: CURRENCY, issuer: ISSUER, value: String(value) };
}

/** Establish real trustlines to the Testnet RLUSD issuer for investor + buyer. Idempotent. */
export async function setupRlusd() {
  if (kvGet('rlusd_ready') === '1') return;
  // issuer is the proceeds destination, so it also needs a trustline for a real RLUSD payment.
  for (const role of ['investor', 'buyer', 'issuer']) {
    const w = getWallet(role);
    if (!w) continue;
    await submitTx(w, {
      TransactionType: 'TrustSet',
      LimitAmount: rlusdAmount('1000000'),
    }, { feature: `rlusd-trust-${role}` });
  }
  kvSet('rlusd_ready', '1');
  console.log('[rlusd] trustlines to Testnet RLUSD issuer', ISSUER, 'established');
}

export async function getRlusdBalance(address) {
  try {
    const c = await getClient();
    const lines = await c.request({ command: 'account_lines', account: address, peer: ISSUER });
    const line = lines.result.lines.find((l) => l.currency === CURRENCY);
    return line ? line.balance : '0';
  } catch {
    return null;
  }
}

/**
 * Pay bond proceeds in RLUSD (investor → bond issuer). Uses real Testnet RLUSD if the payer holds
 * enough; otherwise falls back to the self-issued IOU payment so the demo always shows a payment.
 * Returns { txHash, simulated, asset, amount, fellBack }.
 */
export async function payProceeds({ amount = '100', fromRole = 'investor' } = {}) {
  const payer = getWallet(fromRole);
  const issuerRow = getWalletRow('issuer');
  const payerBal = Number(await getRlusdBalance(payer.classicAddress)) || 0;

  if (payerBal >= Number(amount)) {
    const res = await submitTx(payer, {
      TransactionType: 'Payment',
      Destination: issuerRow.address,
      Amount: rlusdAmount(amount),
    }, { feature: 'rlusd-pay' });
    return { txHash: res.hash, simulated: res.simulated, asset: 'RLUSD', amount, fellBack: false };
  }

  // Fallback: pay with the self-issued IOU (real on-chain token, just not the canonical RLUSD issuer).
  const res = await submitTx(payer, {
    TransactionType: 'Payment',
    Destination: issuerRow.address,
    Amount: iouAmount(amount),
  }, { feature: 'rlusd-pay-iou' });
  return { txHash: res.hash, simulated: res.simulated, asset: 'RLUSD (self-issued IOU)', amount, fellBack: true };
}

async function hasRlusdTrustline(address) {
  try {
    const c = await getClient();
    const lines = await c.request({ command: 'account_lines', account: address, peer: ISSUER });
    return lines.result.lines.some((l) => l.currency === CURRENCY);
  } catch {
    return false;
  }
}

export async function getRlusdStatus() {
  const out = { issuer: ISSUER, currency: CURRENCY, faucet: config.rlusdFaucetUrl, wallets: [] };
  for (const role of ['investor', 'buyer', 'issuer']) {
    const row = getWalletRow(role);
    if (!row) continue;
    const [bal, trust] = await Promise.all([getRlusdBalance(row.address), hasRlusdTrustline(row.address)]);
    out.wallets.push({ role, address: row.address, rlusd: bal ?? '0', hasTrustline: trust });
  }
  out.funded = out.wallets.some((w) => Number(w.rlusd) > 0);
  return out;
}
