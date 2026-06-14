// Green-bond standards/frameworks. A bond may align with several at once, so `standards` is an
// array everywhere. `projectTypes` = project types considered valid under that framework; `abbrev`
// keeps the on-chain credential URI compact (<=128 bytes).

export const STANDARDS = {
  ICMA:          { label: 'ICMA',                   abbrev: 'I', frameworkName: 'ICMA Green Bond Principles', projectTypes: ['USE_OF_PROCEEDS', 'GREEN_REVENUE', 'PROJECT'] },
  EU_TAXONOMY:   { label: 'EU_Taxonomy',            abbrev: 'T', frameworkName: 'EU Taxonomy',               projectTypes: ['GREEN_REVENUE', 'USE_OF_PROCEEDS', 'PROJECT'] },
  EU_GREEN_BOND: { label: 'EU_Green_Bond_Standard', abbrev: 'G', frameworkName: 'EU Green Bond Standard',    projectTypes: ['EU_GREEN', 'USE_OF_PROCEEDS', 'PROJECT'] },
  CLIMATE_BONDS: { label: 'Climate_Bonds',          abbrev: 'C', frameworkName: 'Climate Bonds Standard',    projectTypes: ['USE_OF_PROCEEDS', 'PROJECT', 'GREEN_REVENUE'] },
};

export const STANDARD_CODES = Object.keys(STANDARDS);

// Per the business plan, a bond must pass ALL THREE of these to hold green status.
// (EU Green Bond Standard is the overarching regime label, not one of the three pass criteria.)
export const CORE_STANDARDS = ['ICMA', 'EU_TAXONOMY', 'CLIMATE_BONDS'];

/** Coerce a single string or array into a validated, non-empty array of standard codes. */
export function normalizeStandards(input) {
  const arr = Array.isArray(input) ? input : input ? [input] : [];
  const valid = arr.filter((s) => STANDARDS[s]);
  return valid.length ? valid : ['ICMA'];
}

export const labelFor = (code) => STANDARDS[code]?.label || code;
export const abbrevFor = (code) => STANDARDS[code]?.abbrev || '?';
export const frameworkNameFor = (code) => STANDARDS[code]?.frameworkName || code;
export const projectTypesFor = (code) => STANDARDS[code]?.projectTypes || [];
