import crypto from 'node:crypto';
import { getClient } from './client.js';

/**
 * Deterministic 64-char hex "transaction hash" used when a real submission can't land
 * (amendment not enabled on this network, network unreachable, or hard tx failure).
 * Deterministic so re-running the seed produces stable values.
 */
function simHash(feature, key) {
  return crypto.createHash('sha256').update(`SIM:${feature}:${key}`).digest('hex').toUpperCase().slice(0, 64);
}

const isSuccess = (code) => code === 'tesSUCCESS';
// Codes worth one retry (sequence/fee/load issues are transient).
const isRetryable = (code) =>
  typeof code === 'string' && (code.startsWith('ter') || code === 'tefPAST_SEQ' || code === 'tefMAX_LEDGER' || code === 'telINSUF_FEE_P');
// Amendment-not-enabled / malformed feature → fall back to simulation rather than fail the demo.
const isAmendmentDisabled = (code, msg = '') =>
  code === 'temDISABLED' ||
  code === 'temMALFORMED' ||
  /not enabled|unknown|amendment|disabled/i.test(msg);

/**
 * Submit a transaction with autofill + sign, retry once on transient errors, and fall back to a
 * deterministic simulated record on hard failure. NEVER throws — always resolves to a result object.
 *
 * When `allowFail` is true, a hard tx failure (tec/tem) is returned as a real failure
 * `{ failed:true, code, simulated:false, hash:null }` instead of being masked by a simulated hash —
 * used by flows that want to surface a genuine on-chain rejection (e.g. tecNO_AUTH).
 *
 * @returns {Promise<{hash:string|null, simulated:boolean, code:string|null, failed?:boolean, result?:object, note?:string}>}
 */
export async function submitTx(wallet, tx, { feature = 'tx', simKey, allowFail = false } = {}) {
  const key = simKey || `${tx.TransactionType}:${wallet?.classicAddress || 'na'}:${Date.now()}`;

  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const client = await getClient();
      const prepared = await client.autofill({ ...tx, Account: wallet.classicAddress });
      const signed = wallet.sign(prepared);
      const res = await client.submitAndWait(signed.tx_blob);
      const code = res.result?.meta?.TransactionResult ?? res.result?.engine_result ?? null;

      if (isSuccess(code)) {
        return { hash: res.result.hash, simulated: false, code, result: res.result };
      }
      if (isRetryable(code) && attempt === 0) {
        lastErr = code;
        continue; // retry once with a fresh autofill
      }
      if (allowFail) {
        return { hash: null, simulated: false, failed: true, code, note: `on-chain rejection (${code})`, result: res.result };
      }
      if (isAmendmentDisabled(code)) {
        return { hash: simHash(feature, key), simulated: true, code, note: `amendment unavailable (${code}), simulated` };
      }
      // Other tec/tem failures: simulate so the demo always populates, but record the code.
      return { hash: simHash(feature, key), simulated: true, code, note: `tx failed (${code}), simulated` };
    } catch (err) {
      lastErr = err;
      const msg = err?.message || String(err);
      const code = err?.data?.error || err?.name || null;
      if (isAmendmentDisabled(code, msg)) {
        return { hash: simHash(feature, key), simulated: true, code, note: `amendment unavailable, simulated: ${msg}` };
      }
      if (attempt === 0) continue; // one retry on network/connection hiccup
      if (allowFail) {
        return { hash: null, simulated: false, failed: true, code: code || 'error', note: msg };
      }
      console.warn(`[safeSubmit] ${feature} failed, simulating:`, msg);
      return { hash: simHash(feature, key), simulated: true, code, note: `error, simulated: ${msg}` };
    }
  }
  return { hash: simHash(feature, key), simulated: true, code: String(lastErr), note: 'exhausted retries, simulated' };
}

export { simHash };
