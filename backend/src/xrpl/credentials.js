import { convertStringToHex } from 'xrpl';
import { submitTx, simHash } from './safeSubmit.js';
import { getWallet } from './wallet.js';
import {
  insertCredential, getCredential, getCredentialsBySubject,
  getActiveCredentialForBond, updateCredentialStatus, getWalletRow,
} from '../db.js';
import { normalizeStandards, labelFor, abbrevFor } from '../standards.js';

/**
 * On-chain CredentialType. A credential is uniquely keyed on-chain by (Issuer, Subject, Type),
 * so per-bond credentials issued to the same issuer wallet must use a per-bond type to avoid
 * `tecDUPLICATE`. The DB stores the base type (e.g. 'GreenBondVerified') for app queries.
 */
function onchainType(type, bondId) {
  return bondId ? `${type}.${bondId}` : type;
}

/** CredentialType is a variable-length hex string (<= 64 bytes). */
function credTypeHex(type, bondId) {
  return convertStringToHex(onchainType(type, bondId));
}

/**
 * Issue an on-chain credential (XLS-70). The verifier issues; the subject auto-accepts.
 * params: { subjectAddress, credentialType, fields, bondId, expiresAt }
 * Returns { credentialId(row), credentialType, txHash, simulated }.
 */
export async function issueCredential(params) {
  const verifier = getWallet('verifier');
  const subjectAddr = params.subjectAddress;
  const typeHex = credTypeHex(params.credentialType, params.bondId);

  const verifiedAt = Math.floor(Date.now() / 1000);
  const standards = normalizeStandards(params.fields?.standards ?? params.fields?.standard);

  const verifierName = params.fields?.verifierName || 'KPMG';
  let fields;
  if (params.credentialType === 'GreenBondVerified') {
    // The green-verification credential attests Pass for each standard the bond claims.
    const perStandard = {};
    for (const code of standards) perStandard[labelFor(code)] = 'Pass';
    fields = {
      Bond_Status: 'Green_Verified',
      Verified_By: verifierName,
      Standards: standards.map(labelFor).join(', '),
      ...perStandard,
      verifiedAt,
    };
  } else {
    fields = {
      standard: standards[0],
      verifiedAt,
      covenantStatus: params.fields?.covenantStatus || 'VERIFIED',
      verifierName: 'KPMG',
      ...params.fields,
    };
  }

  // On-chain URI must hex-encode to <= 256 chars (128 bytes); keep it compact. Full detail
  // lives in the DB `fields_json`. Compact attestation: status + verifier + standard abbrevs.
  const compact = params.credentialType === 'GreenBondVerified'
    ? { bs: 'GV', vb: verifierName.slice(0, 16), s: standards.map(abbrevFor).join(''), t: verifiedAt }
    : { s: standards[0], st: fields.covenantStatus || 'VERIFIED', t: verifiedAt };
  const createTx = {
    TransactionType: 'CredentialCreate',
    Subject: subjectAddr,
    CredentialType: typeHex,
    URI: convertStringToHex(JSON.stringify(compact)),
  };
  if (params.expiresAt) createTx.Expiration = params.expiresAt; // ripple-time seconds

  const created = await submitTx(verifier, createTx, {
    feature: 'cred-create', simKey: `cred:${params.credentialType}:${subjectAddr}:${params.bondId}`,
  });

  // subject accepts (no-op if simulated, but we still attempt for realism)
  const subjectWallet = walletForAddress(subjectAddr);
  if (subjectWallet) {
    await submitTx(subjectWallet, {
      TransactionType: 'CredentialAccept',
      Issuer: getWalletRow('verifier').address,
      CredentialType: typeHex,
    }, { feature: 'cred-accept', simKey: `cred-accept:${params.credentialType}:${subjectAddr}` });
  }

  const credentialId = simHash('cred', `${params.credentialType}:${subjectAddr}:${params.bondId}:${created.hash}`).slice(0, 48);
  const rowId = insertCredential({
    credential_id: credentialId,
    subject_address: subjectAddr,
    bond_id: params.bondId ?? null,
    credential_type: params.credentialType,
    fields_json: JSON.stringify(fields),
    tx_hash: created.hash,
    simulated: created.simulated ? 1 : 0,
    expires_at: params.expiresAt || null,
  });

  return { id: rowId, credentialId, credentialType: params.credentialType, txHash: created.hash, simulated: created.simulated };
}

/** Revoke (delete) a credential by DB row id. Returns { txHash, simulated }. */
export async function revokeCredential(rowId) {
  const row = getCredential(rowId);
  if (!row) throw new Error(`credential ${rowId} not found`);
  const verifier = getWallet('verifier');

  const res = await submitTx(verifier, {
    TransactionType: 'CredentialDelete',
    Subject: row.subject_address,
    CredentialType: credTypeHex(row.credential_type, row.bond_id),
  }, { feature: 'cred-delete', simKey: `cred-del:${row.credential_id}` });

  updateCredentialStatus(rowId, 'REVOKED', res.hash);
  return { txHash: res.hash, simulated: res.simulated };
}

/** Revoke the active credential of a given type on a bond, if present. */
export async function revokeBondCredential(bondId, type = 'GreenBondVerified') {
  const cred = getActiveCredentialForBond(bondId, type);
  if (!cred) return null;
  const res = await revokeCredential(cred.id);
  return { ...res, credentialId: cred.credential_id };
}

export function getCredentials(address) {
  return getCredentialsBySubject(address).filter((c) => c.status === 'ACTIVE');
}

function walletForAddress(address) {
  for (const role of ['issuer', 'investor', 'verifier']) {
    const r = getWalletRow(role);
    if (r?.address === address) return getWallet(role);
  }
  return null;
}
