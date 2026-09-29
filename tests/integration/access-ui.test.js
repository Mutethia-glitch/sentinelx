const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const { createPool } = require('../../src/data/pool');
const { authRepository } = require('../../src/data/auth-repository');
const { accessRepository } = require('../../src/data/access-repository');
const { authService } = require('../../src/auth/service');
const { accessService } = require('../../src/access/service');
const { hashPassword } = require('../../src/auth/passwords');
const { configFromEnv } = require('../../src/auth/config');
const { createServer } = require('../../src/api/server');
const { executeSql } = require('../../src/data/postgres');
const { migrationSql } = require('../../scripts/migrate');
test('browser displays role-appropriate controls and backend rejects DOM-forged access', async t => {
  assert.equal(process.env.SENTINELX_TEST_DATABASE, '1', 'Use a disposable test database.');
  executeSql(migrationSql());
  const pool = createPool();
  const users = [];
  let server;
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    const ids = users.map(user => user.id);
    await pool.query('DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[]) OR target_id = ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM auth_sessions WHERE user_id = ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
    await pool.end();
  });
  const authRepo = authRepository(pool);
  const repository = accessRepository(pool);
  const config = configFromEnv({});
  const authentication = authService(authRepo, config);
  const password = 'Synthetic browser passphrase only';
  const hash = await hashPassword(password);
  for (const role of ['Administrator', 'Security Analyst', 'Viewer/Management']) {
    const email = `ui-${randomUUID()}@example.invalid`;
    const displayName = role === 'Viewer/Management' ? '<img src=x onerror=alert(1)>' : `Synthetic ${role}`;
    const id = await authRepo.createUser(email, displayName, hash, 'synthetic UI test operator');
    users.push({ id, email, role });
  }
  await repository.bootstrapAdministrator(users[0].email, 'synthetic UI test operator');
  for (const user of users.slice(1)) await repository.setRoles(users[0].id, user.id, [user.role], 'Assign browser test role');
  server = createServer(authentication, config, accessService(repository, authentication));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  config.origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const contexts = [];
  const pages = [];
  const errors = [];
  for (const user of users) {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    pages.push(page);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => { errors.push('Unexpected script dialog'); dialog.dismiss(); });
    await page.goto(`${config.origin}/access`);
    await page.locator('#login-panel').waitFor({ state: 'visible' });
    await page.locator('#email').fill(user.email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('message').textContent === 'Signed in.');
    assert.equal(await page.locator('#password').inputValue(), '');
    assert.equal(await page.locator('#users-panel').isVisible(), user.role === 'Administrator');
    if (user.role !== 'Administrator') {
      const results = await page.evaluate(async id => {
        // Even manually revealing controls does not grant server permissions.
        document.getElementById('users-panel').hidden = false;
        const read = await fetch('/api/access/users');
        const write = await fetch(`/api/access/users/${id}/roles`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Role': 'Administrator' },
          body: JSON.stringify({ roles: ['Administrator'], reason: 'Synthetic forged UI request' }),
        });
        return [read.status, write.status];
      }, users[0].id);
      assert.deepEqual(results, [403, 403]);
      await page.getByRole('button', { name: 'Refresh access' }).click();
      await page.locator('#users-panel').waitFor({ state: 'hidden' });
    }
  }
  assert.equal(await pages[2].locator('#identity img').count(), 0);
  assert.ok((await pages[2].locator('#identity').textContent()).includes('<img src=x onerror=alert(1)>'));
  // Use the actual Administrator form to upgrade and downgrade an account.
  const targetCard = pages[0].locator('.user-card').filter({ hasText: users[2].email });
  await targetCard.getByLabel('Viewer/Management').uncheck();
  await targetCard.getByLabel('Security Analyst').check();
  await targetCard.getByLabel('Reason for changing access').fill('Browser-verified role change');
  await targetCard.getByRole('button', { name: 'Save roles' }).click();
  await pages[0].waitForFunction(() => document.getElementById('message').textContent.startsWith('Roles saved.'));
  assert.deepEqual(await repository.rolesForUser(users[2].id), ['Security Analyst']);
  await pages[2].getByRole('button', { name: 'Refresh access' }).click();
  await pages[2].locator('#login-panel').waitFor({ state: 'visible' });
  assert.equal(await pages[2].locator('#users-panel').isVisible(), false);
  // Attempting to remove the last Administrator is rejected in both UI and API.
  const ownCard = pages[0].locator('.user-card').filter({ hasText: users[0].email });
  await ownCard.getByLabel('Administrator', { exact: true }).uncheck();
  await ownCard.getByLabel('Reason for changing access').fill('Synthetic last Administrator attempt');
  await ownCard.getByRole('button', { name: 'Save roles' }).click();
  await pages[0].waitForFunction(() => document.getElementById('message').textContent === 'The last active Administrator cannot be removed.');
  assert.deepEqual(await repository.rolesForUser(users[0].id), ['Administrator']);
  await pages[0].getByRole('button', { name: 'Sign out' }).click();
  await pages[0].locator('#login-panel').waitFor({ state: 'visible' });
  assert.equal(await pages[0].locator('#users-panel').isVisible(), false);
  assert.deepEqual(errors, []);
  for (const context of contexts) await context.close();
});
