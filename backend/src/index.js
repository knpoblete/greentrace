import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getClient, isConnected } from './xrpl/client.js';
import { listWallets } from './xrpl/wallet.js';
import { getDomainInfo } from './xrpl/domain.js';
import { getRlusdStatus } from './xrpl/rlusd.js';
import { seed } from './seed.js';
import { startAgentLoop } from './agent/verifier.js';

import walletsRouter from './routes/wallets.js';
import bondsRouter from './routes/bonds.js';
import escrowRouter from './routes/escrow.js';
import credentialsRouter from './routes/credentials.js';
import agentRouter from './routes/agent.js';
import rlusdRouter from './routes/rlusd.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  let wallets = [];
  let rlusd = null;
  try { wallets = await listWallets(); } catch { /* ignore */ }
  try { rlusd = await getRlusdStatus(); } catch { /* ignore */ }
  res.json({
    ok: true,
    xrpl: { node: config.xrplNode, connected: isConnected() },
    domain: getDomainInfo(),
    rlusd,
    wallets,
    time: Date.now(),
  });
});

app.use('/api/wallets', walletsRouter);
app.use('/api/bonds', bondsRouter);
app.use('/api/escrow', escrowRouter);
app.use('/api/credentials', credentialsRouter);
app.use('/api/agent', agentRouter);
app.use('/api/rlusd', rlusdRouter);

app.use((req, res) => res.status(404).json({ error: 'not found' }));

async function start() {
  // Connect to XRPL (non-fatal if it fails — seed/agent degrade to simulation).
  try {
    await getClient();
  } catch (err) {
    console.warn('[startup] XRPL connection failed, continuing in degraded mode:', err?.message);
  }

  try {
    await seed();
  } catch (err) {
    console.warn('[startup] seed error (continuing):', err?.message);
  }

  startAgentLoop(config.agentIntervalMs, config.agentStartDelayMs);

  app.listen(config.port, () => {
    console.log(`[server] GreenTrace backend listening on http://localhost:${config.port}`);
  });
}

start();

process.on('unhandledRejection', (err) => console.warn('[unhandledRejection]', err?.message || err));
process.on('uncaughtException', (err) => console.warn('[uncaughtException]', err?.message || err));
