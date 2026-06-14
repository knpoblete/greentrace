import { Router } from 'express';
import { config } from '../config.js';
import { getBond } from '../db.js';
import { depositToVault, getVaultInfo, getVaultShareBalance } from '../xrpl/vault.js';
import { getWalletRow } from '../db.js';

const router = Router();
const txLink = (hash) => (hash ? `${config.explorerBase}${hash}` : null);

// POST /api/vault/deposit — { bondId, amount, role } investor deposits RLUSD → receives MPT shares
router.post('/deposit', async (req, res) => {
  try {
    const { bondId, amount, role = 'investor' } = req.body || {};
    const bond = getBond(Number(bondId));
    if (!bond) return res.status(404).json({ error: 'bond not found' });
    if (!bond.vault_id) return res.status(400).json({ error: 'this bond has no vault' });
    const result = await depositToVault(bond.vault_id, role, amount || '1000');
    const shares = await getVaultShareBalance(getWalletRow(role).address, bond.share_issuance_id);
    res.json({ ...result, txLink: txLink(result.txHash), shares });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vault/:bondId — vault ledger info + the caller-role's share balance
router.get('/:bondId', async (req, res) => {
  try {
    const bond = getBond(Number(req.params.bondId));
    if (!bond?.vault_id) return res.json({ open: false });
    const [info, shares] = await Promise.all([
      getVaultInfo(bond.vault_id),
      getVaultShareBalance(getWalletRow('investor').address, bond.share_issuance_id),
    ]);
    res.json({ open: true, vaultId: bond.vault_id, shareIssuanceId: bond.share_issuance_id, investorShares: shares, info });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
