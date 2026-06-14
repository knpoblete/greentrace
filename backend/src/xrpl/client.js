import { Client, Wallet } from 'xrpl';
import { config } from '../config.js';

let client = null;
let connecting = null;

/**
 * Returns a connected singleton XRPL client, reconnecting if needed.
 * Never throws synchronously — callers should await and handle rejection.
 */
export async function getClient() {
  if (client && client.isConnected()) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    if (!client) {
      client = new Client(config.xrplNode, { timeout: 20000 });
      client.on('disconnected', () => {
        console.warn('[xrpl] disconnected from', config.xrplNode);
      });
    }
    if (!client.isConnected()) {
      await client.connect();
      console.log('[xrpl] connected to', config.xrplNode);
    }
    connecting = null;
    return client;
  })();

  return connecting;
}

export function isConnected() {
  return Boolean(client && client.isConnected());
}

/**
 * Fund a wallet from the testnet faucet. Returns the funded balance (XRP) or null on failure.
 * `seed` optional — if provided, funds the existing wallet rather than generating a new one.
 */
export async function fundWallet(seed = null) {
  const c = await getClient();
  const existing = seed ? Wallet.fromSeed(seed) : undefined;
  const { wallet, balance } = await c.fundWallet(existing);
  return { wallet, balance };
}

export async function getXrpBalance(address) {
  try {
    const c = await getClient();
    const bal = await c.getXrpBalance(address);
    return String(bal);
  } catch {
    return null;
  }
}

export async function disconnect() {
  if (client && client.isConnected()) await client.disconnect();
}
