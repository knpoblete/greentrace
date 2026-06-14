import { Router } from 'express';
import { config } from '../config.js';
import { getWalletRow, getAllBonds, getCredentialsBySubject } from '../db.js';
import { getXrpBalance } from '../xrpl/client.js';
import { getIouBalance } from '../xrpl/iou.js';
import { getMptHoldings } from '../xrpl/mpt.js';

const router = Router();
const txLink = (hash) => (hash ? `${config.explorerBase}${hash}` : null);

// GET /api/portfolio/:role — wallet summary for a persona: address, XRP + RLUSD (settlement IOU)
// balances, KYC/green credentials, and bond holdings (matched from on-chain MPToken objects).
router.get('/:role', async (req, res) => {
  try {
    const row = getWalletRow(req.params.role);
    if (!row) return res.status(404).json({ error: `wallet '${req.params.role}' not found` });

    const [xrp, rlusd, holdingsRaw] = await Promise.all([
      getXrpBalance(row.address),
      getIouBalance(row.address),
      getMptHoldings(row.address),
    ]);

    const bonds = getAllBonds();
    const holdings = holdingsRaw.map((h) => {
      const bondTok = bonds.find((b) => b.mpt_issuance_id === h.mptIssuanceId);
      const vaultBond = bonds.find((b) => b.share_issuance_id === h.mptIssuanceId);
      const bond = bondTok || vaultBond;
      return {
        mptIssuanceId: h.mptIssuanceId,
        amount: h.amount,
        kind: vaultBond ? 'vault-shares' : 'bond',
        bondId: bond?.id || null,
        bondName: bond?.bond_name || 'Unknown',
        standard: bond?.standard || null,
        greenStatus: bond?.green_status || null,
      };
    });

    const credentials = getCredentialsBySubject(row.address)
      .filter((c) => c.status === 'ACTIVE')
      .map((c) => ({ type: c.credential_type, fields: JSON.parse(c.fields_json || '{}'), txHash: c.tx_hash, txLink: txLink(c.tx_hash), simulated: !!c.simulated }));

    res.json({
      role: req.params.role,
      address: row.address,
      xrp: xrp ?? row.balance ?? '0',
      rlusd: rlusd ?? '0',
      credentials,
      kyc: credentials.some((c) => c.type === 'InvestorKYC'),
      holdings,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
