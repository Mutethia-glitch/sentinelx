const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const { createPool } = require('../../src/data/pool');
const { eventRepository } = require('../../src/data/event-repository');
const { authRepository } = require('../../src/data/auth-repository');
const { accessRepository } = require('../../src/data/access-repository');
const { authService } = require('../../src/auth/service');
const { accessService } = require('../../src/access/service');
const { eventViewService } = require('../../src/events/view-service');
const { ingestionService, approvedSources } = require('../../src/events/ingestion');
const { hashPassword } = require('../../src/auth/passwords');
const { configFromEnv } = require('../../src/auth/config');
const { createServer } = require('../../src/api/server');
const { executeSql } = require('../../src/data/postgres');
const { migrationSql } = require('../../scripts/migrate');
test('PostgreSQL event filters, browser inspection and live role boundaries preserve evidence without XSS', async t => {
  assert.equal(process.env.SENTINELX_TEST_DATABASE, '1', 'Use a disposable database.');
  executeSql(migrationSql()); const pool = createPool(); const users = []; const events = []; let browser; let server;
  t.after(async () => {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    const ids = users.map(user => user.id);
    await pool.query('DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM auth_sessions WHERE user_id = ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM security_events WHERE id = ANY($1::uuid[])', [events]); await pool.end();
  });
  const config = configFromEnv({}); const eventRepo = eventRepository(pool); const authRepo = authRepository(pool);
  const authentication = authService(authRepo, config); const access = accessService(accessRepository(pool), authentication);
  const password = 'Synthetic event browser passphrase'; const hash = await hashPassword(password);
  for (const role of ['Administrator', 'Security Analyst', 'Viewer/Management', null]) {
    const email = `${randomUUID()}@example.invalid`; const id = await authRepo.createUser(email, 'Synthetic event tester', hash, 'synthetic test operator'); users.push({ id, email, role });
    if (role) await pool.query('INSERT INTO user_roles(user_id, role_id) SELECT $1, id FROM roles WHERE name=$2', [id, role]);
  }
  const source = `event-ui-${randomUUID()}`;
  const malicious = '<img src=x onerror=alert(1)>';
  const fixture = { timestamp: '2026-09-30T00:00:00Z', source, type: 'authentication', sourceIp: '192.0.2.10', destinationIp: '2001:db8::10', user: '1000_literal', host: 'synthetic-host', action: 'login', status: 'failed', severity: 'LOW', rawData: { html: malicious, original: [false, 1, null] }, metadata: { evidence: malicious } };
  for (let i = 0; i < 51; i++) events.push((await eventRepo.create(fixture)).id);
  const selected = await eventRepo.create({ ...fixture, timestamp: '2026-10-01T00:00:00Z', severity: 'CRITICAL', user: `100%_ ${malicious}` }); events.push(selected.id);
  const pending = await pool.query('INSERT INTO security_events(source, event_type, occurred_at, raw_data) VALUES ($1, $2, $3, $4::jsonb) RETURNING id', [source, 'network', '2026-09-01T00:00:00Z', JSON.stringify({ pending: true })]);
  events.push(pending.rows[0].id);
  const pendingDetail = await eventRepo.getById(pending.rows[0].id); assert.equal(pendingDetail.event, null); assert.deepEqual(pendingDetail.rawData, { pending: true }); assert.equal(pendingDetail.source, source);
  const query = filters => eventRepo.list({ page: 1, source, ...filters });
  assert.equal((await query({})).events.length, 50); assert.equal((await query({})).hasMore, true);
  assert.equal((await query({ page: 2 })).events.length, 3);
  for (const filters of [{ severity: 'CRITICAL' }, { q: '100%_' }, { from: '2026-10-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' }, { user: `100%_ ${malicious}` }]) {
    const result = await query(filters); assert.equal(result.events.length, 1); assert.equal(result.events[0].id, selected.id);
  }
  const ipQuery = await query({ sourceIp: fixture.sourceIp, destinationIp: fixture.destinationIp, host: fixture.host, status: fixture.status, type: fixture.type }); assert.equal(ipQuery.events.length, 50);
  assert.equal((await query({ severity: 'UNKNOWN' })).events.length, 1);
  assert.equal((await query({ q: "' OR 1=1 --" })).events.length, 0);
  assert.equal('rawData' in ipQuery.events[0], false); assert.equal('metadata' in ipQuery.events[0], false);
  server = createServer(authentication, config, access, ingestionService(eventRepo, access, approvedSources({})), eventViewService(eventRepo, access));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${server.address().port}`; config.origin = base;
  const anon = await fetch(`${base}/api/events/${selected.id}`); assert.equal(anon.status, 401);
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const pages = []; const errors = [];
  for (const user of users) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await context.newPage(); pages.push(page);
    page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => { errors.push('unexpected dialog'); dialog.dismiss(); });
    await page.goto(`${base}/events`);
    await page.getByLabel('Email', { exact: true }).fill(user.email); await page.getByLabel('Application passphrase').fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    if (!user.role) {
      await page.waitForFunction(() => document.getElementById('message').textContent.includes('does not have permission'));
      assert.equal(await page.locator('#events-panel').isVisible(), false);
      assert.equal(await page.evaluate(async () => (await fetch('/api/events', { headers: { 'X-Role': 'Administrator' } })).status), 403);
      assert.equal(await page.evaluate(async id => (await fetch(`/api/events/${id}`)).status, selected.id), 403);
    } else {
      await page.locator('#events-panel').waitFor({ state: 'visible' });
      await page.getByLabel('Source', { exact: true }).fill(source); await page.getByRole('button', { name: 'Apply filters' }).click();
      await page.waitForFunction(() => document.querySelectorAll('#rows tr').length === 50);
    }
    await page.waitForFunction(() => document.getElementById('password').value === '');
  }
  await pages[0].setViewportSize({ width: 390, height: 844 });
  assert.equal(await pages[0].evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await pages[0].screenshot({ path: '/tmp/sentinelx-events-mobile.png' });
  const analyst = pages[1];
  await analyst.getByRole('button', { name: 'Next', exact: true }).click();
  await analyst.waitForFunction(() => document.getElementById('page').textContent === 'Page 2'); assert.equal(await analyst.locator('#rows tr').count(), 3);
  await analyst.getByLabel('Severity', { exact: true }).selectOption('CRITICAL'); await analyst.getByRole('button', { name: 'Apply filters' }).click();
  await analyst.waitForFunction(() => document.querySelectorAll('#rows tr').length === 1);
  assert.ok((await analyst.locator('#rows').textContent()).includes(malicious)); assert.equal(await analyst.locator('#rows img').count(), 0);
  await analyst.screenshot({ path: '/tmp/sentinelx-events-list.png', fullPage: true });
  await analyst.getByRole('button', { name: `Inspect event ${selected.id}` }).click(); await analyst.locator('#detail-panel').waitFor({ state: 'visible' });
  assert.ok((await analyst.locator('#raw-data').textContent()).includes(malicious)); assert.equal(await analyst.locator('#detail-panel img').count(), 0);
  assert.ok((await analyst.locator('#normalized-data').textContent()).includes('CRITICAL'));
  assert.equal('rawData' in JSON.parse(await analyst.locator('#normalized-data').textContent()), false);
  await analyst.screenshot({ path: '/tmp/sentinelx-events-detail.png' });
  await analyst.getByLabel('Search', { exact: true }).fill('no-such-synthetic-value'); await analyst.getByRole('button', { name: 'Apply filters' }).click();
  await analyst.waitForFunction(() => document.getElementById('results').textContent === 'No events match these filters.'); assert.equal(await analyst.locator('#detail-panel').isVisible(), false);
  // Live roles apply even when an existing session cookie remains present.
  await pool.query('DELETE FROM user_roles WHERE user_id=$1', [users[2].id]);
  await pages[2].getByRole('button', { name: 'Apply filters' }).click(); await pages[2].waitForFunction(() => document.getElementById('message').textContent.includes('does not have permission'));
  assert.equal(await pages[2].locator('#rows tr').count(), 0);
  await analyst.getByRole('button', { name: 'Sign out', exact: true }).click(); await analyst.locator('#login-panel').waitFor({ state: 'visible' });
  assert.equal(await analyst.locator('#rows tr').count(), 0); assert.equal(await analyst.locator('#raw-data').textContent(), '');
  assert.equal(await analyst.evaluate(async () => (await fetch('/api/events')).status), 401);
  assert.deepEqual(errors, []);
});
