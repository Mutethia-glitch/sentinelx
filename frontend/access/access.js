'use strict';
const ui=window.SentinelXUi;
const element = id => document.getElementById(id);
const message = (text, isError = false) => {
  const notice = element('message');
  notice.classList.toggle('error', isError);
  notice.textContent = isError ? `Error: ${text}` : text;
  if (isError) notice.scrollIntoView({ block: 'center' });
};
async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(result?.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return result;
}
function reset() {ui.clearAccess();
  element('login-panel').hidden = false;
  element('identity-panel').hidden = true;
  element('users-panel').hidden = true;
  element('users').replaceChildren();
  element('identity').textContent = '';
  element('assigned-roles').textContent = '';
}
function handleError(error) {
  if (error.status === 401) reset();
  message(error.status ? error.message : 'Unable to reach SentinelX. Try again.', true);
}
function userCard(user, roles) {
  const form = document.createElement('form');
  form.className = 'user-card';
  const heading = document.createElement('h3');
  heading.textContent = `${user.displayName} (${user.email})${user.active ? '' : ' — inactive'}`;
  form.append(heading);
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Approved roles';
  fieldset.append(legend);
  const boxes = roles.map(role => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = user.roles.includes(role.name);
    checkbox.value = role.name;
    label.append(checkbox, document.createTextNode(role.name));
    fieldset.append(label);
    return checkbox;
  });
  const reasonLabel = document.createElement('label');
  reasonLabel.textContent = 'Reason for changing access';
  const reason = document.createElement('input');
  reason.required = true;
  reason.maxLength = 500;
  reasonLabel.append(reason);
  const save = document.createElement('button');
  save.type = 'submit';
  save.textContent = 'Save roles';
  form.append(fieldset, reasonLabel, save);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    save.disabled = true;
    try {
      await request(`/api/access/users/${encodeURIComponent(user.id)}/roles`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: boxes.filter(box => box.checked).map(box => box.value), reason: reason.value }),
      });
      await refresh();
      message('Roles saved. Changed users must sign in again.');
    } catch (error) { handleError(error); }
    finally { save.disabled = false; }
  });
  return form;
}
async function refresh() {
  ui.loading('Loading access…');
  // Clear sensitive controls first so an expired/downgraded session cannot leave them visible.
  element('users-panel').hidden = true;
  element('users').replaceChildren();
  const access = await request('/api/access/me');ui.applyAccess(access);
  element('login-panel').hidden = true;
  element('identity-panel').hidden = false;
  element('identity').textContent = `${access.user.displayName} · ${access.user.email}`;
  element('assigned-roles').textContent = access.roles.length ? `Roles: ${access.roles.join(', ')}` : 'No role assigned. Ask an Administrator to configure your access.';
  if (access.permissions.includes('users.read') && access.permissions.includes('users.roles.manage')) {
    const [users, roles] = await Promise.all([request('/api/access/users'), request('/api/access/roles')]);
    element('users').replaceChildren(...users.users.map(user => userCard(user, roles.roles)));
    element('users-panel').hidden = false;
  }
}
element('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: element('email').value, password: element('password').value }) });
    await refresh();
    message('Signed in.');
  } catch (error) { handleError(error); }
  finally { element('password').value = ''; button.disabled = false; }
});
element('logout').addEventListener('click', async () => {
  try {
    await request('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    reset();
    message('Signed out.');
  } catch (error) { handleError(error); }
});
element('refresh').addEventListener('click', () => refresh().catch(handleError));
refresh().catch(error => { reset(); if (error.status !== 401) handleError(error); });
