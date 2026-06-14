import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { getClient, isConnected } from './xrpl/client.js';
import { listWallets } from './xrpl/wallet.js';
import { getDomainInfo } from './xrpl/domain.js';
import { getRlusdStatus } from './xrpl/rlusd.js';
import { seed, getSeedState } from './seed.js';
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

// Lightweight, synchronous status (no XRPL calls) — safe to poll frequently, e.g. the seeding banner.
app.get('/api/status', (req, res) => {
  res.json({ ok: true, seedState: getSeedState(), seeding: getSeedState() !== 'ready', time: Date.now() });
});

app.get('/api/health', async (req, res) => {
  let wallets = [];
  let rlusd = null;
  try { wallets = await listWallets(); } catch { /* ignore */ }
  try { rlusd = await getRlusdStatus(); } catch { /* ignore */ }
  res.json({
    ok: true,
    seedState: getSeedState(),
    seeding: getSeedState() !== 'ready',
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

// Serve the built React app (production single-service deploy) + SPA fallback for client routes.
// The regex excludes /api/, so API + SSE routing is unaffected.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(distDir));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.use((req, res) => res.status(404).json({ error: 'not found' }));

function start() {
  // Listen FIRST so the port opens immediately (Render/host health checks pass right away),
  // then connect to XRPL and run the seed in the background. The API stays responsive while
  // seeding (~2 min on a cold start); the frontend shows loading states until data arrives.
  app.listen(config.port, () => {
    console.log(`[server] GreenTrace listening on :${config.port}`);
  });

  getClient().catch((err) =>
    console.warn('[startup] XRPL connection failed, continuing in degraded mode:', err?.message));

  seed()
    .catch((err) => console.warn('[startup] seed error (continuing):', err?.message))
    .finally(() => startAgentLoop(config.agentIntervalMs, config.agentStartDelayMs));
}

start();

process.on('unhandledRejection', (err) => console.warn('[unhandledRejection]', err?.message || err));
process.on('uncaughtException', (err) => console.warn('[uncaughtException]', err?.message || err));
