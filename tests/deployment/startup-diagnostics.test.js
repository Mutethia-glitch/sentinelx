const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('production startup reports a fixed configuration stage without revealing env contents', () => {
  const sentinel = 'PRIVATE_DIAGNOSTIC_CANARY_DO_NOT_PRINT';
  const result = spawnSync(process.execPath, [path.join(__dirname, '../../src/api/server.js')], {
    env: {
      PATH: process.env.PATH || '',
      NODE_ENV: 'production',
      PORT: 'invalid-port-' + sentinel,
      DATABASE_URL: 'postgresql://user:' + sentinel + '@localhost/no_database',
    },
    encoding: 'utf8',
    timeout: 3000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Authentication server could not start at configuration\./);
  assert.ok(!result.stderr.includes(sentinel), 'must not print secrets or malformed config values');
  assert.ok(!result.stderr.includes('postgresql://'), 'must not print connection URLs');
});
