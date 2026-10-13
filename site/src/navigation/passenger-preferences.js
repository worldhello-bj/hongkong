/** Public passenger choices. Facility evidence is independent of preference. */
export const PASSENGER_NEEDS = Object.freeze(['ordinary', 'luggage', 'escalator', 'lift']);
const removedNeeds = new Set(['accessible', 'accessibility', 'strict', 'strict_accessibility',
  'strict-accessibility', 'wheelchair', 'wheelchair_accessible', 'wheelchair-accessible',
  'step_free', 'step-free', 'stepfree', '严格无障碍']);
const key = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
export function isRemovedPassengerNeed(value) { return removedNeeds.has(key(value)); }
export function normalizePassengerNeed(value) {
  const normalized = key(value);
  return PASSENGER_NEEDS.includes(normalized) ? normalized : 'ordinary';
}

/** Product routing boundary; private source-evidence probes remain independent. */
export function normalizeEnginePreference(value) {
  const normalized = key(value);
  return ['fast', 'luggage', 'escalator_first', 'lift_first'].includes(normalized) ? normalized : 'fast';
}
