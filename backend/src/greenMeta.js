import crypto from 'node:crypto';
import { frameworkNameFor, projectTypesFor } from './standards.js';

// Deterministic pseudo-random integer in [0, mod) derived from a seed string — keeps generated
// bond attributes stable across reseeds.
function hashInt(seed, mod) {
  const h = crypto.createHash('md5').update(seed).digest();
  return h.readUInt32BE(0) % mod;
}

// ISIN check digit: expand letters (A=10…Z=35) to digits, then Luhn over the whole string.
function isinCheckDigit(body) {
  const digits = body.split('').map((c) => (/[0-9]/.test(c) ? c : String(c.charCodeAt(0) - 55))).join('');
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}

function generateIsin(name) {
  const body = 'XS' + String(hashInt(`isin:${name}`, 1e9)).padStart(9, '0'); // 11 chars
  return body + isinCheckDigit(body); // 12-char ISIN with valid check digit
}

function useOfProceeds(name, projectType) {
  const n = name.toLowerCase();
  if (/solar/.test(n)) return 'Solar Energy Generation';
  if (/wind/.test(n)) return 'Offshore Wind Power';
  if (/hydro|water/.test(n)) return 'Hydroelectric & Water Management';
  if (/transit|transport|rail|mobility/.test(n)) return 'Clean Transportation';
  if (/build|housing|infrastructure/.test(n)) return 'Green Buildings';
  return {
    USE_OF_PROCEEDS: 'Renewable Energy',
    GREEN_REVENUE: 'Clean Transportation',
    PROJECT: 'Sustainable Infrastructure',
    EU_GREEN: 'Energy Efficiency',
  }[projectType] || 'Climate Mitigation';
}

/**
 * Build the rich green-metadata block embedded in (and stored alongside) an issued bond.
 * Values are auto-generated deterministically from the bond name / standards / project type.
 */
export function buildGreenMeta({ bondName, standards, projectType, covenants, issuedAtMs }) {
  const passes = {};
  let passingCount = 0;
  for (const code of ['ICMA', 'EU_TAXONOMY', 'EU_GREEN_BOND', 'CLIMATE_BONDS']) {
    const selected = standards.includes(code);
    const aligned = projectTypesFor(code).includes(projectType);
    const pass = selected && aligned;
    if (pass) passingCount += 1;
    passes[`${code.toLowerCase()}_pass`] = pass; // icma_pass, eu_taxonomy_pass, …
  }

  const hasEmissionsCovenant = covenants?.maxEmissions != null;
  const verify_score = Math.min(100, 60 + 10 * passingCount + (hasEmissionsCovenant ? 10 : 0));

  return {
    isin: generateIsin(bondName),
    coupon: (2.5 + hashInt(`coupon:${bondName}`, 46) * 0.05).toFixed(2),
    maturity: String(new Date().getFullYear() + 7 + hashInt(`maturity:${bondName}`, 4)),
    use_of_proceeds: useOfProceeds(bondName, projectType),
    frameworks: standards.map(frameworkNameFor),
    ...passes,
    verify_score,
    issued_date: new Date(issuedAtMs).toISOString(),
  };
}
