import { Router } from 'express';
import { config } from '../config.js';
import { getRlusdStatus, payProceeds } from '../xrpl/rlusd.js';

const router = Router();
const txLink = (hash) => (hash ? `${config.explorerBase}${hash}` : null);

// GET /api/rlusd/status — issuer, trustlines, balances, faucet link
router.get('/status', async (req, res) => {
  try {
    res.json(await getRlusdStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rlusd/pay — { amount, fromRole } pay bond proceeds in RLUSD (IOU fallback)
router.post('/pay', async (req, res) => {
  try {
    const { amount, fromRole } = req.body || {};
    const result = await payProceeds({ amount, fromRole });
    res.json({ ...result, txLink: txLink(result.txHash) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
