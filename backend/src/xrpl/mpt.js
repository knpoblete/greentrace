import { convertStringToHex } from 'xrpl';
import { submitTx, simHash } from './safeSubmit.js';
import { getWallet } from './wallet.js';
import { insertBond, getBond, getWalletRow, getCredentialsBySubject } from '../db.js';
import { DOMAIN_CRED_TYPES } from './domain.js';
import { normalizeStandards, labelFor } from '../standards.js';
import { buildGreenMeta } from '../greenMeta.js';
import { iouAmount } from './iou.js';

const TF_MPT_CAN_TRANSFER = 0x00000002;
const TF_MPT_REQUIRE_AUTH = 0x00000004;

/** Extract the MPTokenIssuanceID from a submit result, or synthesize a deterministic one. */
function extractIssuanceId(result, fallbackKey) {
  const meta = result?.meta;
  if (meta?.mpt_issuance_id) return meta.mpt_issuance_id;
  // scan AffectedNodes for the created MPTokenIssuance
  const created = (meta?.AffectedNodes || [])
    .map((n) => n.CreatedNode)
    .find((c) => c?.LedgerEntryType === 'MPTokenIssuance');
  if (created?.LedgerIndex) return created.LedgerIndex;
  return simHash('mpt-id', fallbackKey).slice(0, 48);
}

/**
 * Issue a green bond as an MPToken (XLS-33).
 * params: { bondName, standards (array) | standard, projectType, covenants, maxAmount, transferFee }
 * A bond may align with multiple standards/frameworks at once.
 * Returns { bondId, mptIssuanceId, txHash, simulated, metadata }.
 */
export async function issueBond(params) {
  const issuer = getWallet('issuer');
  const issuerRow = getWalletRow('issuer');
  const verifierRow = getWalletRow('verifier');

  const standards = normalizeStandards(params.standards ?? params.standard);
  const issuedAtMs = Date.now();
  const green = buildGreenMeta({
    bondName: params.bondName,
    standards,
    projectType: params.projectType,
    covenants: params.covenants || {},
    issuedAtMs,
  });

  // Flat metadata used by the app (agent reads covenants/standards/etc. from this in the DB).
  // Includes the rich green-instrument fields (isin/coupon/maturity/use_of_proceeds/frameworks/
  // per-framework pass/verify_score/issued_date), surfaced in the UI and on-chain via additional_info.
  const metadata = {
    name: params.bondName,
    standards,
    standard: standards[0], // back-compat for any single-value reader
    projectType: params.projectType,
    covenants: params.covenants || {},
    issuedAt: Math.floor(issuedAtMs / 1000),
    verifier: verifierRow?.address || null,
    ...green,
  };

  // XLS-89-compliant shape for the on-chain MPTokenMetadata (<=9 top-level fields, recognised by explorers).
  const ticker = params.bondName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'GBOND';
  const onchainMeta = {
    ticker,
    name: params.bondName,
    desc: `${standards.map(labelFor).join(', ')} green bond — ${params.projectType}`,
    icon: 'https://testnet.xrpl.org/favicon.ico',
    asset_class: 'rwa',
    asset_subclass: 'other',
    issuer_name: 'GreenTrace',
    additional_info: metadata,
  };

  const tx = {
    TransactionType: 'MPTokenIssuanceCreate',
    AssetScale: 2,
    MaximumAmount: String(params.maxAmount ?? '1000000'),
    Flags: TF_MPT_REQUIRE_AUTH | TF_MPT_CAN_TRANSFER,
    MPTokenMetadata: convertStringToHex(JSON.stringify(onchainMeta)),
  };
  if (params.transferFee) tx.TransferFee = Number(params.transferFee);

  const res = await submitTx(issuer, tx, { feature: 'mpt-issue', simKey: `mpt:${params.bondName}` });
  const mptIssuanceId = extractIssuanceId(res.result, params.bondName);

  const bondId = insertBond({
    mpt_issuance_id: mptIssuanceId,
    issuer_address: issuerRow.address,
    bond_name: params.bondName,
    standard: standards.join(','),
    project_type: params.projectType,
    metadata_json: JSON.stringify(metadata),
    tx_hash: res.hash,
    simulated: res.simulated ? 1 : 0,
  });

  return { bondId, mptIssuanceId, txHash: res.hash, simulated: res.simulated, metadata };
}

/**
 * Authorize an investor to hold the bond MPT, then have the investor opt in.
 * Returns { authorizeHash, holdHash, simulated }.
 */
export async function mintToInvestor(bondId, investorAddress, amount) {
  const bond = getBond(bondId);
  if (!bond) throw new Error(`bond ${bondId} not found`);
  const issuer = getWallet('issuer');
  const investor = getWallet('investor');
  const target = investorAddress || investor.classicAddress;

  // issuer authorizes the holder for a require-auth issuance
  const auth = await submitTx(issuer, {
    TransactionType: 'MPTokenAuthorize',
    MPTokenIssuanceID: bond.mpt_issuance_id,
    Holder: target,
  }, { feature: 'mpt-authorize', simKey: `mpt-auth:${bondId}` });

  // investor opts in (creates their MPToken object)
  const hold = await submitTx(investor, {
    TransactionType: 'MPTokenAuthorize',
    MPTokenIssuanceID: bond.mpt_issuance_id,
  }, { feature: 'mpt-hold', simKey: `mpt-hold:${bondId}` });

  return {
    authorizeHash: auth.hash,
    holdHash: hold.hash,
    simulated: auth.simulated || hold.simulated,
  };
}

/** Does this account hold an active verifier-issued credential that admits it to the domain? */
function isCredentialed(address) {
  return getCredentialsBySubject(address).some(
    (c) => c.status === 'ACTIVE' && DOMAIN_CRED_TYPES.includes(c.credential_type)
  );
}

/**
 * Attempt to buy/receive a bond MPT as `role` (e.g. 'investor' = Wallet A, 'buyer' = Wallet B).
 * Enforces the permissioned-domain policy: only credentialed accounts are authorized. An
 * uncredentialed account's transfer is REJECTED on-chain with `tecNO_AUTH` (require-auth MPT).
 */
export async function buyBond(bondId, role = 'investor', amount = '10') {
  const bond = getBond(bondId);
  if (!bond) throw new Error(`bond ${bondId} not found`);
  const issuer = getWallet('issuer');
  const buyer = getWallet(role);
  if (!buyer) throw new Error(`wallet '${role}' not found`);
  const settlementRlusd = String(Number(amount) * 100); // purchase price: 100 RLUSD per unit

  const credentialed = isCredentialed(buyer.classicAddress);
  const mptAmount = { mpt_issuance_id: bond.mpt_issuance_id, value: String(amount) };
  const steps = [];

  // Buyer opts in (creates their MPToken holding — allowed even before authorization).
  const optIn = await submitTx(buyer, {
    TransactionType: 'MPTokenAuthorize',
    MPTokenIssuanceID: bond.mpt_issuance_id,
  }, { feature: 'buy-optin', simKey: `optin:${role}:${bondId}` });
  steps.push({ step: 'holder opt-in (MPTokenAuthorize)', wallet: role, txHash: optIn.hash, simulated: optIn.simulated });

  if (!credentialed) {
    // Policy: no GreenBondVerified / InvestorKYC credential ⇒ issuer will NOT authorize.
    // Demonstrate the real on-chain consequence: the transfer is rejected with tecNO_AUTH.
    const attempt = await submitTx(issuer, {
      TransactionType: 'Payment',
      Destination: buyer.classicAddress,
      Amount: mptAmount,
    }, { feature: 'buy-payment-rejected', simKey: `buyrej:${role}:${bondId}`, allowFail: true });
    steps.push({ step: 'bond transfer (Payment)', wallet: 'issuer→' + role, txHash: attempt.hash, failed: !!attempt.failed, code: attempt.code });

    return {
      accepted: false,
      role,
      buyerAddress: buyer.classicAddress,
      credentialed: false,
      reason: 'Rejected — wallet holds no GreenBondVerified/InvestorKYC credential, so it is not a member of the permissioned domain and cannot be authorized to hold this bond.',
      onChainCode: attempt.code || 'tecNO_AUTH',
      steps,
    };
  }

  // Credentialed: issuer authorizes the holder, then transfers the bond MPT.
  const auth = await submitTx(issuer, {
    TransactionType: 'MPTokenAuthorize',
    MPTokenIssuanceID: bond.mpt_issuance_id,
    Holder: buyer.classicAddress,
  }, { feature: 'buy-authorize', simKey: `buyauth:${role}:${bondId}` });
  steps.push({ step: 'issuer authorizes holder (MPTokenAuthorize)', wallet: 'issuer', txHash: auth.hash, simulated: auth.simulated });

  const pay = await submitTx(issuer, {
    TransactionType: 'Payment',
    Destination: buyer.classicAddress,
    Amount: mptAmount,
  }, { feature: 'buy-payment', simKey: `buy:${role}:${bondId}` });
  steps.push({ step: 'bond delivery (Payment, MPT)', wallet: 'issuer→' + role, txHash: pay.hash, simulated: pay.simulated });

  // Settlement: investor pays the purchase price in RLUSD (self-issued IOU) to the issuer.
  const settle = await submitTx(buyer, {
    TransactionType: 'Payment',
    Destination: issuer.classicAddress,
    Amount: iouAmount(settlementRlusd),
  }, { feature: 'buy-settle-rlusd', simKey: `buysettle:${role}:${bondId}` });
  steps.push({ step: `RLUSD settlement (${settlementRlusd} RLUSD)`, wallet: role + '→issuer', txHash: settle.hash, simulated: settle.simulated });

  return {
    accepted: !pay.failed,
    role,
    buyerAddress: buyer.classicAddress,
    credentialed: true,
    reason: pay.failed ? `Transfer failed on-chain (${pay.code})` : `Accepted — credentialed domain member authorized, bond delivered, and ${settlementRlusd} RLUSD settled.`,
    onChainCode: pay.code || 'tesSUCCESS',
    amount,
    settlementRlusd,
    steps,
  };
}
