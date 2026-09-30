const assert = require('node:assert/strict');
const { createPool } = require('../src/data/pool');
const { INITIAL_RULES } = require('../src/rules/initial-rules');
const { detectionEngine } = require('../src/detection/engine');
const fixture = require('../fixtures/events/initial-rule-scenarios.json');

function event(patch) { return { ...fixture.baseEvent, ...patch }; }
function evidence(count) { return Array.from({ length: count }, (_, index) => ({ id: `task14-evidence-${index + 1}` })); }

async function verifyInitialRules(pool) {
  const names = INITIAL_RULES.map(rule => rule.name);
  const result = await pool.query(`SELECT r.name, r.description, r.enabled, r.threat_level, r.category_code, r.definition,
    ARRAY(SELECT m.technique_id FROM rule_mitre_mappings rm JOIN mitre_mappings m ON m.id=rm.mapping_id
      WHERE rm.rule_id=r.id ORDER BY m.technique_id) AS mitre_ids
    FROM detection_rules r WHERE r.name = ANY($1::text[]) ORDER BY r.name`, [names]);
  assert.equal(result.rows.length, INITIAL_RULES.length, 'all fifteen initial rules must be installed');
  const persisted = new Map(result.rows.map(row => [row.name, row]));

  for (const expected of INITIAL_RULES) {
    const row = persisted.get(expected.name);
    assert.ok(row, `missing ${expected.categoryCode} rule`);
    assert.equal(row.description, expected.description);
    assert.equal(row.enabled, false, `${expected.categoryCode} must be seeded disabled`);
    assert.equal(row.threat_level, expected.severity);
    assert.equal(row.category_code, expected.categoryCode);
    assert.deepEqual(row.definition, expected.definition);
    assert.deepEqual(row.mitre_ids, expected.mitreTechniqueIds);

    const scenario = fixture.scenarios.find(item => item.categoryCode === expected.categoryCode);
    assert.ok(scenario, `missing ${expected.categoryCode} test data`);
    const rule = { id: expected.name, name: expected.name, severity: expected.severity, categoryCode: expected.categoryCode, definition: row.definition };
    const repository = {
      enabledRules: async () => [rule],
      matchingEvents: async () => evidence(row.definition.threshold),
      createAlert: async () => ({ id: `expected-${expected.categoryCode}` }),
    };
    assert.equal((await detectionEngine(repository).evaluate({ id: 'positive', event: event(scenario.match) })).length, scenario.expectedAlerts);
    repository.matchingEvents = async () => evidence(row.definition.threshold - 1);
    assert.equal((await detectionEngine(repository).evaluate({ id: 'below', event: event(scenario.match) })).length, scenario.belowThresholdAlerts);
    repository.matchingEvents = async () => { throw new Error('non-match queried evidence'); };
    assert.equal((await detectionEngine(repository).evaluate({ id: 'negative', event: event({ ...scenario.match, ...scenario.nonMatch }) })).length, scenario.nonMatchAlerts);
  }
  return { count: result.rows.length };
}

async function main() {
  let pool;
  try {
    pool = createPool();
    const result = await verifyInitialRules(pool);
    console.log(`${result.count} initial detection rules, all taxonomy categories, severities, logic, thresholds and expected outputs verified.`);
  } catch {
    console.error('Task 14 initial-rule verification failed. Check migrations and PostgreSQL configuration locally. No credentials were printed.');
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}

if (require.main === module) main();
module.exports = { verifyInitialRules };
