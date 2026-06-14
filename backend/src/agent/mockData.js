// Deterministic mock inputs for the rule-based compliance agent (no external calls, per spec §7).
// Keyed by bond DB id. Bond 2 deliberately breaches its emissions covenant (1200 > 1000).

export const MOCK_EMISSIONS = {
  1: 850,
  2: 1200,
  3: 600,
};

export const MOCK_MILESTONES = {
  1: ['planning', 'construction'],
  2: ['planning'],
  3: ['planning', 'construction', 'reporting'],
};

export function getMockEmissions(bondId) {
  return MOCK_EMISSIONS[bondId] ?? 500; // newly issued bonds default to a compliant value
}

export function getCompletedMilestones(bondId) {
  return MOCK_MILESTONES[bondId] ?? ['planning'];
}

export function isMilestoneComplete(bondId, milestone) {
  return getCompletedMilestones(bondId).includes(milestone);
}
