const test = require('node:test');
const assert = require('node:assert/strict');
const { INITIAL_RULES } = require('../../src/rules/initial-rules');
const { detectionEngine, validDefinition } = require('../../src/detection/engine');
const fixture = require('../../fixtures/events/initial-rule-scenarios.json');

const expectedCategories = [
  'BRUTE_FORCE','CREDENTIAL_ATTACK','PRIVILEGE_ESCALATION','SUSPICIOUS_ACCOUNT_ACTIVITY','UNAUTHORIZED_ACCESS',
  'RECONNAISSANCE','SUSPICIOUS_NETWORK_ACTIVITY','PHISHING_SOCIAL_ENGINEERING','MALWARE','RANSOMWARE',
  'DENIAL_OF_SERVICE','DATA_EXFILTRATION','WEB_APPLICATION_ATTACK','INSIDER_THREAT','SUPPLY_CHAIN_COMPROMISE',
];

function event(patch) { return { ...fixture.baseEvent, ...patch }; }
function matches(count) { return Array.from({ length: count }, (_, index) => ({ id: `event-${index + 1}` })); }

for (const rule of INITIAL_RULES) {
  test(`${rule.categoryCode} core rule has valid logic and expected outputs`, async () => {
    assert.equal(rule.enabled, false);
    assert.equal(validDefinition(rule.definition), true);
    const scenario = fixture.scenarios.find(item => item.categoryCode === rule.categoryCode);
    assert.ok(scenario, `missing scenario for ${rule.categoryCode}`);
    let createCount = 0;
    const repository = {
      enabledRules: async () => [rule],
      matchingEvents: async () => matches(rule.definition.threshold),
      createAlert: async () => { createCount += 1; return { id: `alert-${rule.categoryCode}` }; },
    };
    assert.equal((await detectionEngine(repository).evaluate({ id: 'trigger', event: event(scenario.match) })).length, scenario.expectedAlerts);
    assert.equal(createCount, 1);

    repository.matchingEvents = async () => matches(rule.definition.threshold - 1);
    assert.equal((await detectionEngine(repository).evaluate({ id: 'below', event: event(scenario.match) })).length, scenario.belowThresholdAlerts);

    createCount = 0;
    repository.matchingEvents = async () => { throw new Error('non-match must not query threshold evidence'); };
    assert.equal((await detectionEngine(repository).evaluate({ id: 'negative', event: event({ ...scenario.match, ...scenario.nonMatch }) })).length, scenario.nonMatchAlerts);
    assert.equal(createCount, 0);
  });
}

test('initial core rules cover all fifteen approved taxonomy categories exactly once', () => {
  assert.equal(INITIAL_RULES.length, 15);
  assert.deepEqual([...INITIAL_RULES.map(rule => rule.categoryCode)].sort(), [...expectedCategories].sort());
  assert.equal(new Set(INITIAL_RULES.map(rule => rule.categoryCode)).size, 15);
  assert.equal(new Set(INITIAL_RULES.map(rule => rule.name)).size, 15);
  assert.equal(fixture.scenarios.length, 15);
});
