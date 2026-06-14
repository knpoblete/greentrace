import { Wallet } from 'xrpl';
import { fundWallet, getXrpBalance } from './client.js';
import { getWalletRow, getAllWallets, upsertWallet, updateWalletBalance } from '../db.js';

// `buyer` (Wallet B) is the deliberately uncredentialed account used for the rejection demo.
export const ROLES = ['issuer', 'investor', 'verifier', 'buyer'];

/** Generate + faucet-fund a new wallet, persisting it under `role`. Falls back to an
 *  unfunded local keypair if the faucet is unreachable (so seed never crashes). */
export async function generateWallet(role) {
  try {
    const { wallet, balance } = await fundWallet();
    upsertWallet({ role, address: wallet.classicAddress, seed: wallet.seed, balance: String(balance) });
    console.log(`[wallet] funded ${role} ${wallet.classicAddress} (${balance} XRP)`);
    return wallet;
  } catch (err) {
    const wallet = Wallet.generate();
    upsertWallet({ role, address: wallet.classicAddress, seed: wallet.seed, balance: '0' });
    console.warn(`[wallet] faucet unavailable for ${role}, generated unfunded:`, err?.message);
    return wallet;
  }
}

/** Return an xrpl.Wallet for the given role, loading the seed from SQLite. */
export function getWallet(role) {
  const row = getWalletRow(role);
  if (!row?.seed) return null;
  return Wallet.fromSeed(row.seed);
}

/** Ensure all three demo wallets exist + are funded. Idempotent. */
export async function ensureWallets() {
  for (const role of ROLES) {
    const row = getWalletRow(role);
    if (!row) {
      await generateWallet(role);
    } else if (Number(row.balance) <= 0) {
      // try to (re)fund existing wallet
      try {
        const { balance } = await fundWallet(row.seed);
        updateWalletBalance(role, String(balance));
      } catch { /* leave as-is */ }
    }
  }
}

/** Public wallet list (no seeds), with live balances refreshed best-effort. */
export async function listWallets() {
  const rows = getAllWallets();
  const out = [];
  for (const r of rows) {
    const live = await getXrpBalance(r.address);
    if (live != null && live !== r.balance) updateWalletBalance(r.role, live);
    out.push({ role: r.role, address: r.address, balance: live ?? r.balance });
  }
  return out;
}
