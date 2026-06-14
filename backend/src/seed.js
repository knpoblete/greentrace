import { ensureWallets, getWallet } from './xrpl/wallet.js';
import { setupIou, restoreIou } from './xrpl/iou.js';
import { setupRlusd } from './xrpl/rlusd.js';
import { setupDomain } from './xrpl/domain.js';
import { issueBond, mintToInvestor } from './xrpl/mpt.js';
import { createEscrow } from './xrpl/escrow.js';
import { issueCredential } from './xrpl/credentials.js';
import { countBonds, getWalletRow, kvGet, kvSet } from './db.js';

// All demo bonds claim the three core standards (ICMA, EU Taxonomy, Climate Bonds) so they can hold
// green status, and start COMPLIANT + credentialed (initial KPMG attestation at issuance). The agent
// later flags Coastal Wind (emissions breach) for verifier review; KPMG attestation flips it to BREACH.
const DEMO_BONDS = [
  {
    bondName: 'Solar Farm Green Bond',
    standards: ['ICMA', 'EU_TAXONOMY', 'CLIMATE_BONDS', 'EU_GREEN_BOND'],
    projectType: 'USE_OF_PROCEEDS',
    covenants: { maxEmissions: 1000, milestones: ['planning', 'construction', 'reporting'] },
    maxAmount: '1000000',
    escrowAmount: '500000',
    credential: true,
  },
  {
    bondName: 'Coastal Wind Bond',
    standards: ['ICMA', 'EU_TAXONOMY', 'CLIMATE_BONDS'],
    projectType: 'GREEN_REVENUE',
    covenants: { maxEmissions: 1000, milestones: ['planning', 'construction', 'reporting'] },
    maxAmount: '1000000',
    escrowAmount: '300000',
    credential: true, // green at issuance; emissions 1200 → flagged by agent → revoked on attestation
  },
  {
    bondName: 'Urban Transit Bond',
    standards: ['ICMA', 'EU_TAXONOMY', 'CLIMATE_BONDS'],
    projectType: 'PROJECT',
    covenants: { maxEmissions: 1000, milestones: ['planning', 'construction', 'reporting'] },
    maxAmount: '1000000',
    escrowAmount: '250000',
    credential: true,
  },
];

// Seed lifecycle, surfaced via /api/health so the UI can show an "initializing" state during the
// ~2-min cold-start seed (the server listens before seeding completes).
let seedState = 'pending'; // 'pending' | 'running' | 'ready' | 'error'
export const getSeedState = () => seedState;

/**
 * Idempotent seed. On an empty DB: wallets → IOU → domain → 3 bonds → escrows → credentials.
 * The breaching agent cycle is intentionally NOT run here so the live "Run Now" demo flips
 * Coastal Wind from AT_RISK → BREACH (spec §"Demo Flow").
 */
export async function seed() {
  seedState = 'running';
  try {
    await runSeed();
    seedState = 'ready';
  } catch (err) {
    seedState = 'error';
    throw err;
  }
}

async function runSeed() {
  console.log('[seed] ensuring wallets…');
  await ensureWallets();

  console.log('[seed] setting up self-issued RLUSD IOU…');
  await setupIou();

  console.log('[seed] setting up real Testnet RLUSD trustlines…');
  await setupRlusd();

  console.log('[seed] setting up permissioned domain…');
  await setupDomain();

  // Issue an InvestorKYC credential to the investor (Wallet A) so it is a domain member; the
  // buyer (Wallet B) deliberately gets none, so its bond purchase is rejected.
  const investorRow = getWalletRow('investor');
  if (kvGet('investor_kyc') !== '1') {
    await issueCredential({
      subjectAddress: investorRow.address,
      credentialType: 'InvestorKYC',
      fields: { standard: 'EU_GREEN_BOND', covenantStatus: 'KYC_VERIFIED' },
    });
    kvSet('investor_kyc', '1');
  }

  if (countBonds() > 0) {
    console.log('[seed] bonds already present — skipping on-chain bond seed (idempotent).');
    restoreIou();
    return;
  }

  const issuerRow = getWalletRow('issuer');
  for (const def of DEMO_BONDS) {
    console.log(`[seed] issuing bond: ${def.bondName}`);
    const { bondId } = await issueBond({
      bondName: def.bondName,
      standards: def.standards,
      projectType: def.projectType,
      covenants: def.covenants,
      maxAmount: def.maxAmount,
    });

    await mintToInvestor(bondId).catch((e) => console.warn('[seed] mint failed:', e?.message));

    await createEscrow({
      bondId,
      amount: def.escrowAmount,
      milestones: def.covenants.milestones,
    });

    if (def.credential) {
      // Initial KPMG attestation at issuance → green credential on-chain. Bond stays COMPLIANT
      // until the agent flags it for review and a verifier attests a change.
      await issueCredential({
        subjectAddress: issuerRow.address,
        credentialType: 'GreenBondVerified',
        bondId,
        fields: { standards: def.standards, covenantStatus: 'COMPLIANT' },
      });
    }
  }

  console.log('[seed] complete — 3 bonds live, all COMPLIANT + KPMG-credentialed (agent will flag Coastal Wind on first run).');
}
