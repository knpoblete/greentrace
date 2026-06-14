import { Router } from 'express';
import { config } from '../config.js';
import { getAgentLogs } from '../db.js';
import { runAllBonds, runVerificationCycle, agentBus } from '../agent/verifier.js';

const router = Router();
const txLink = (hash) => (hash ? `${config.explorerBase}${hash}` : null);

// GET /api/agent/logs — last 50 entries
router.get('/logs', (req, res) => {
  try {
    const logs = getAgentLogs(50).map((l) => ({
      id: l.id,
      bondId: l.bond_id,
      bondName: l.bond_name,
      prevStatus: l.prev_status,
      status: l.status,
      findings: JSON.parse(l.findings_json || '[]'),
      actionTaken: l.action_taken,
      txHash: l.tx_hash,
      txLink: txLink(l.tx_hash),
      simulated: !!l.simulated,
      ts: l.created_at,
    }));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/run — manually trigger a cycle (all bonds, or { bondId })
router.post('/run', async (req, res) => {
  try {
    const { bondId } = req.body || {};
    const results = bondId ? [await runVerificationCycle(Number(bondId))] : await runAllBonds();
    res.json({ ran: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/stream — Server-Sent Events for live agent updates
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no', // prevent platform proxy from buffering the event stream
  });
  res.write(`event: hello\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

  const onCycle = (payload) => res.write(`data: ${JSON.stringify({ ...payload, txLink: txLink(payload.txHash) })}\n\n`);
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  agentBus.on('cycle', onCycle);

  req.on('close', () => {
    clearInterval(ping);
    agentBus.off('cycle', onCycle);
  });
});

export default router;
