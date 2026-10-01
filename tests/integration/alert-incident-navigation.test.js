const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createServer } = require('../../src/api/server');
const { configFromEnv } = require('../../src/auth/config');
const { statusInput, createInput } = require('../../src/incidents/model');
const { statusUpdateInput } = require('../../src/alerts/model');

test('real HTTP alert update and incident navigation preserve IDs, prefill and creation', async t => {
  const id = '00000000-0000-4000-8000-000000000001';
  const otherId = '00000000-0000-4000-8000-000000000002';
  const alert = { id, timestamp: '2026-10-01T00:00:00Z', severity: 'HIGH', threat: 'BRUTE_FORCE', source: 'iphyn-app', status: 'NEW', confidence: null, rule: { id: otherId, name: 'Repeated failures' }, events: [], affectedEntities: {}, matchEvidence: {}, matchReason: 'Five failed logins' };
  const other = { ...alert, id: otherId };
  const user = { id: otherId, displayName: 'Test administrator', email: 'test@example.invalid', active: true, roles: ['Administrator'] };
  const identity = { user, roles: user.roles, permissions: ['alerts.read', 'alerts.manage', 'incidents.read', 'incidents.manage', 'users.read'] };
  let created, changedStatus;
  const config = configFromEnv({});
  const server = createServer({}, config, { me: async () => identity, users: async () => [user] }, null, null, null, null, {
    list: async () => ({ alerts: [alert, alert, other], page: 1, hasMore: false }),
    inspect: async () => alert,
    authorizeWrite: async () => user,
    updateStatus: async (_, target, body) => { assert.equal(target, id); Object.assign(alert, { status: statusUpdateInput(body).status }); return alert; },
  }, {
    list: async () => ({ incidents: [], page: 1, hasMore: false }),
    authorizeWrite: async () => user,
    updateStatus: async (_, id, body) => { changedStatus = statusInput(body); return { id }; },
    create: async (_, body) => { created = createInput(body); return { id: otherId }; },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  config.origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  t.after(async () => { await browser.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(config.origin + '/alerts');
  await page.locator('#rows button').first().click();
  await page.locator('#alert-status').selectOption('ACKNOWLEDGED');
  await page.getByRole('button', { name: 'Update alert status', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('#rows tr')].slice(0, 2).every(row => row.cells[6].textContent === 'ACKNOWLEDGED'));
  assert.equal(await page.locator('#rows tr').nth(2).locator('td').nth(6).textContent(), 'NEW');
  const update = await page.getByRole('button', { name: 'Update alert status', exact: true }).boundingBox();
  const link = page.getByRole('link', { name: 'Create incident from alert', exact: true });
  const linkBox = await link.boundingBox();
  assert.ok(linkBox.y >= update.y + update.height + 10);
  await link.click();
  await page.waitForURL('**/incidents#fromAlert=*');
  await page.waitForFunction(id => document.querySelector('#create-alerts').value === id, id);
  assert.equal(await page.locator('#create-reason').inputValue(), 'Five failed logins');
  assert.equal(await page.locator('#create-category-context').inputValue(), 'BRUTE_FORCE');
  await page.locator('#create-assignee').selectOption(otherId);
  await page.getByRole('button', { name: 'Create incident', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#message').textContent === 'Incident created.');
  assert.deepEqual(created.alertIds, [id]);
  assert.equal(created.assignedTo, otherId);
  assert.equal(created.reason, 'Five failed logins');
  assert.equal(await page.locator('#create-alerts').inputValue(), '');
  assert.equal(await page.locator('#create-reason').inputValue(), '');
  assert.equal(new URL(page.url()).hash, '');
  await page.reload();
  assert.equal(await page.locator('#create-alerts').inputValue(), '');
  await page.goto(config.origin + '/incidents#fromAlert=' + id);
  await page.reload();
  await page.waitForFunction(id => document.querySelector('#create-alerts').value === id, id);
  await page.locator('#create-status').selectOption('INVESTIGATING');
  await page.getByRole('button', { name: 'Create incident', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#message').textContent === 'Incident created.');
  assert.equal(changedStatus.status, 'INVESTIGATING');
  assert.equal(await page.locator('#incident-status option[value=CONTAINED]').count(), 1);
  assert.deepEqual(errors, []);
});

test('containment refreshes displayed status and completed incidents disable inspection', async t => {
  const id = '00000000-0000-4000-8000-000000000003';
  const user = { id, displayName: 'Test administrator', active: true, roles: ['Administrator'] };
  const identity = { user, roles: user.roles, permissions: ['incidents.read', 'incidents.manage', 'users.read', 'responses.execute', 'investigations.read', 'responses.read'] };
  const incident = { id, title: 'Controlled incident', description: '', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', severity: 'HIGH', categoryCode: 'BRUTE_FORCE', status: 'NEW', alerts: [] };
  const config = configFromEnv({});
  const server = createServer({}, config, { me: async () => identity, users: async () => [user] }, null, null, { list: async () => [] }, null, null, {
    list: async () => ({ incidents: [incident], page: 1, hasMore: false }),
    inspect: async () => incident,
    authorizeWrite: async () => user,
    updateStatus: async (_, target, body) => { assert.equal(target, id); incident.status = statusInput(body).status; return incident; },
  }, { workspace: async () => ({ affectedEntities: { user: [], host: [], sourceIp: [], destinationIp: [] }, events: [], timeline: [], notes: [] }) }, {
    list: async () => ({ actions: [], page: 1, hasMore: false }),
    authorizeWrite: async () => user,
    record: async (_, target, body) => { const { responseInput } = require('../../src/responses/model'); const input = responseInput(body); assert.equal(target, id); if (input.action === 'CONTAINMENT' && input.succeeded && input.containmentPerformed) incident.status = 'CONTAINED'; return {}; },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  config.origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  t.after(async () => { await browser.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); });
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(config.origin + '/incidents');
  await page.getByRole('button', { name: `Inspect incident ${id}` }).click();
  await page.locator('#incident-status').selectOption('CONTAINED');
  await page.getByRole('button', { name: 'Update incident status', exact: true }).click();
  await page.locator('#response-form').waitFor({ state: 'visible' });
  await page.locator('#response-succeeded').check();
  await page.locator('#response-confirmation').check();
  await page.getByRole('button', { name: 'Record manual response', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#message').textContent === 'Manual response recorded.');
  assert.equal(await page.locator('#incident-status').inputValue(), 'CONTAINED');
  assert.match(await page.locator('#response-incident-status').textContent(), /CONTAINED/);
  assert.match(await page.locator('#rows').textContent(), /CONTAINED/);
  for (const status of ['RESOLVED', 'DISMISSED']) {
    if (status === 'DISMISSED') { incident.status = 'NEW'; await page.reload(); await page.getByRole('button', { name: `Inspect incident ${id}` }).click(); }
    await page.locator('#incident-status').selectOption(status);
    await page.getByRole('button', { name: 'Update incident status', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#rows button')?.disabled);
    assert.equal(await page.locator('#detail-panel').isVisible(), false);
    assert.match(await page.locator('#rows').textContent(), new RegExp(status));
  }
  assert.deepEqual(errors, []);
});
