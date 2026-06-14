import { Router } from 'express';
import { config } from '../config.js';
import { createEscrow, releaseEscrow, getEscrowStatus } from '../xrpl/escrow.js';

const router = Router();
const txLink = (hash) => (hash ? `${config.explorerBase}${hash}` : null);

// GET /api/escrow/:bondId
router.get('/:bondId', (req, res) => {
  try {
    res.json(getEscrowStatus(Number(req.params.bondId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/escrow/create — { bondId, amount, milestones }
router.post('/create', async (req, res) => {
  try {
    const { bondId, amount, milestones } = req.body;
    if (!bondId || !amount) return res.status(400).json({ error: 'bondId and amount are required' });
    const result = await createEscrow({ bondId: Number(bondId), amount, milestones });
    res.json({ ...result, txLink: txLink(result.txHash) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/escrow/release — { bondId, milestone }
router.post('/release', async (req, res) => {
  try {
    const { bondId, milestone } = req.body;
    if (!bondId || !milestone) return res.status(400).json({ error: 'bondId and milestone are required' });
    const result = await releaseEscrow(Number(bondId), milestone);
    res.json({ ...result, txLink: txLink(result.txHash) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
