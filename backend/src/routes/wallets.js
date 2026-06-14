import { Router } from 'express';
import { listWallets, generateWallet, ROLES } from '../xrpl/wallet.js';
import { getWalletRow } from '../db.js';
import { fundWallet } from '../xrpl/client.js';

const router = Router();

// GET /api/wallets — addresses + balances, never seeds
router.get('/', async (req, res) => {
  try {
    res.json(await listWallets());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/wallets/fund — { role }
router.post('/fund', async (req, res) => {
  try {
    const { role } = req.body;
    if (!ROLES.includes(role)) return res.status(400).json({ error: `role must be one of ${ROLES.join(', ')}` });
    const row = getWalletRow(role);
    if (!row) {
      await generateWallet(role);
      return res.json({ role, funded: true });
    }
    const { balance } = await fundWallet(row.seed);
    res.json({ role, address: row.address, balance: String(balance), funded: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
