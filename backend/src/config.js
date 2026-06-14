import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: Number(process.env.PORT || 3001),
  xrplNode: process.env.XRPL_NODE || 'wss://s.devnet.rippletest.net:51233',
  dbPath: path.resolve(__dirname, '..', process.env.DB_PATH || './greentrace.db'),
  // Self-issued test IOU used for escrow proceeds. Issuer is resolved at runtime to the
  // local "issuer" wallet address; only the currency code is fixed here.
  rlusdCurrency: process.env.RLUSD_CURRENCY || '524C555344000000000000000000000000000000',
  // Real Ripple USD issuer on XRPL Testnet (top up via https://tryrlusd.com).
  rlusdIssuer: process.env.RLUSD_ISSUER || 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV',
  rlusdFaucetUrl: 'https://tryrlusd.com',
  agentIntervalMs: Number(process.env.AGENT_INTERVAL_MS || 30000),
  // Grace delay before the FIRST automatic cycle, so the live "Run Now" breach flip is
  // demo-controllable. Subsequent cycles run every agentIntervalMs. Set 0 to disable the delay.
  agentStartDelayMs: Number(process.env.AGENT_START_DELAY_MS || 120000),
  // Explorer base derived from the node (devnet/testnet) so tx links resolve on the right network.
  explorerBase: (process.env.XRPL_NODE || '').includes('altnet')
    ? 'https://testnet.xrpl.org/transactions/'
    : 'https://devnet.xrpl.org/transactions/',
};

// Mutable runtime state filled in during seed (domain id, IOU issuer address, etc.)
export const runtime = {
  domainId: null,
  iouIssuer: null,
};
