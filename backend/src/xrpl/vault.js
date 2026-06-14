import { submitTx } from './safeSubmit.js';
import { getClient } from './client.js';
import { getWallet } from './wallet.js';
import { iouAmount, getIou } from './iou.js';
import { getWalletRow } from '../db.js';

// XLS-65 Single Asset Vault. The issuer opens a vault holding the self-issued RLUSD IOU; investors
// deposit RLUSD and receive MPT shares representing their stake (the vault later lends to the issuer
// — that lending leg is XLS-66, deferred to a later phase).

function looksLikeMptId(s) {
  return typeof s === 'string' && /^[0-9A-F]{48}$/i.test(s);
}

/** Pull the share MPTokenIssuanceID out of a Vault ledger node (field name varies by build). */
function extractShareId(node) {
  if (!node) return null;
  return node.ShareMPTID || node.MPTokenIssuanceID || node.SharesID
    || Object.values(node).find(looksLikeMptId) || null;
}

/** Create a single-asset RLUSD vault for a bond. Returns { vaultId, shareIssuanceId, txHash, simulated }. */
export async function createVault() {
  const issuer = getWallet('issuer');
  const { currency, issuer: iouIssuer } = getIou();

  const res = await submitTx(issuer, {
    TransactionType: 'VaultCreate',
    Asset: { currency, issuer: iouIssuer },
  }, { feature: 'vault-create', simKey: `vault:${Date.now()}` });

  let vaultId = null;
  let shareIssuanceId = null;
  const created = (res.result?.meta?.AffectedNodes || []).map((n) => n.CreatedNode).filter(Boolean);
  const vaultNode = created.find((n) => n.LedgerEntryType === 'Vault');
  vaultId = vaultNode?.LedgerIndex || null;
  shareIssuanceId = extractShareId(vaultNode?.NewFields) || extractShareId(vaultNode);

  // If the share id wasn't in the create meta, read it back from the vault ledger entry.
  if (vaultId && !shareIssuanceId) {
    try {
      const c = await getClient();
      const entry = await c.request({ command: 'ledger_entry', vault: vaultId, ledger_index: 'validated' });
      shareIssuanceId = extractShareId(entry.result?.node);
    } catch { /* leave null */ }
  }

  return { vaultId, shareIssuanceId, txHash: res.hash, simulated: res.simulated };
}

/** Investor deposits RLUSD into the bond's vault and receives MPT shares. */
export async function depositToVault(vaultId, role, amount) {
  const wallet = getWallet(role);
  if (!wallet) throw new Error(`wallet '${role}' not found`);
  const res = await submitTx(wallet, {
    TransactionType: 'VaultDeposit',
    VaultID: vaultId,
    Amount: iouAmount(amount),
  }, { feature: 'vault-deposit', simKey: `vault-dep:${role}:${vaultId}` });
  return { txHash: res.hash, simulated: res.simulated };
}

/** Share balance an address holds for a given vault share issuance (best-effort). */
export async function getVaultShareBalance(address, shareIssuanceId) {
  if (!shareIssuanceId) return '0';
  try {
    const c = await getClient();
    const res = await c.request({ command: 'account_objects', account: address, type: 'mptoken', ledger_index: 'validated' });
    const obj = (res.result.account_objects || []).find((o) => o.MPTokenIssuanceID === shareIssuanceId);
    return obj ? String(obj.MPTAmount ?? '0') : '0';
  } catch {
    return '0';
  }
}

export async function getVaultInfo(vaultId) {
  if (!vaultId) return null;
  try {
    const c = await getClient();
    const entry = await c.request({ command: 'ledger_entry', vault: vaultId, ledger_index: 'validated' });
    return entry.result?.node || null;
  } catch {
    return null;
  }
}
