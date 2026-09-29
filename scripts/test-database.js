const fs = require('node:fs');
const path = require('node:path');
const { executeSql } = require('../src/data/postgres');
const { migrationSql } = require('./migrate');
try {
  if (process.env.SENTINELX_TEST_DATABASE !== '1') throw new Error('Use a disposable test database and set SENTINELX_TEST_DATABASE=1.');
  executeSql(migrationSql());
  executeSql(migrationSql());
  executeSql(fs.readFileSync(path.join(__dirname, '../tests/database/core.sql'), 'utf8'));
  console.log('Database migration replay and integrity tests passed. Test data rolled back.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
