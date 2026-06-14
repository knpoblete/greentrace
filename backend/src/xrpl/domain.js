import { convertStringToHex } from 'xrpl';
import { submitTx, simHash } from './safeSubmit.js';
import { getWallet } from './wallet.js';
import { runtime } from '../config.js';
import { kvGet, kvSet, getWalletRow, getAllWallets } from '../db.js';

// Credential types that admit an account to the compliance domain (all issued by the verifier).
const DOMAIN_CRED_TYPES = ['GreenBondVerified', 'InvestorKYC'];
const DOMAIN_CRED_TYPE = DOMAIN_CRED_TYPES[0];

/** AcceptedCredentials entries the domain admits (credentials issued by the verifier). */
function acceptedCredentials() {
  const verifier = getWalletRow('verifier');
  return DOMAIN_CRED_TYPES.map((t) => ({
    Credential: {
      Issuer: verifier.address,
      CredentialType: convertStringToHex(t),
    },
  }));
}

export { DOMAIN_CRED_TYPES };

function extractDomainId(result, fallbackKey) {
  const created = (result?.meta?.AffectedNodes || [])
    .map((n) => n.CreatedNode)
    .find((c) => c?.LedgerEntryType === 'PermissionedDomain');
  return created?.LedgerIndex || simHash('domain', fallbackKey);
}

/** Create the compliance permissioned domain (XLS-80). Idempotent via kv. */
export async function setupDomain() {
  const existing = kvGet('domain_id');
  if (existing) { runtime.domainId = existing; return existing; }

  const issuer = getWallet('issuer');
  const res = await submitTx(issuer, {
    TransactionType: 'PermissionedDomainSet',
    AcceptedCredentials: acceptedCredentials(),
  }, { feature: 'domain-create', simKey: 'domain:greentrace' });

  const domainId = extractDomainId(res.result, 'greentrace');
  runtime.domainId = domainId;
  kvSet('domain_id', domainId);
  kvSet('domain_simulated', res.simulated ? '1' : '0');
  console.log('[domain] permissioned domain', domainId, res.simulated ? '(simulated)' : '');
  return domainId;
}

/** Update accepted credentials on the domain (membership is credential-based, not explicit). */
export async function addToDomain() {
  const issuer = getWallet('issuer');
  const res = await submitTx(issuer, {
    TransactionType: 'PermissionedDomainSet',
    DomainID: runtime.domainId,
    AcceptedCredentials: acceptedCredentials(),
  }, { feature: 'domain-update', simKey: `domain-update:${Date.now()}` });
  return { txHash: res.hash, simulated: res.simulated };
}

/** Domain membership = accounts that currently hold an accepted credential. */
export function getDomainMembers() {
  // For the demo, members are the credentialed demo wallets (verifier-issued GreenBondVerified).
  return getAllWallets().map((w) => ({ role: w.role, address: w.address }));
}

export function getDomainInfo() {
  return {
    domainId: runtime.domainId || kvGet('domain_id'),
    simulated: kvGet('domain_simulated') === '1',
    acceptedCredentialType: DOMAIN_CRED_TYPE,
  };
}
