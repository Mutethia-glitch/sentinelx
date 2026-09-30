const SEVERITY_POINTS = Object.freeze({ LOW: 20, MEDIUM: 40, HIGH: 60, CRITICAL: 80 });
const FORMULA_VERSION = 1;

function eventFrequencyBonus(eventCount) {
  if (!Number.isInteger(eventCount) || eventCount < 0) {
    throw new TypeError('eventCount must be a non-negative integer.');
  }
  return Math.min(20, Math.max(0, eventCount - 1) * 2);
}

function riskScore(severity, eventCount) {
  if (!Object.hasOwn(SEVERITY_POINTS, severity)) throw new TypeError('Unsupported severity.');
  const severityPoints = SEVERITY_POINTS[severity];
  const frequencyPoints = eventFrequencyBonus(eventCount);
  return {
    score: Math.min(100, severityPoints + frequencyPoints),
    severityPoints,
    frequencyPoints,
    eventCount,
    formulaVersion: FORMULA_VERSION,
  };
}

module.exports = { SEVERITY_POINTS, FORMULA_VERSION, eventFrequencyBonus, riskScore };
