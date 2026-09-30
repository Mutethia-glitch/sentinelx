'use strict';
const ui=window.SentinelXUi;
const el = id => document.getElementById(id);
let generation = 0;
let page = 1;
let activeFilters = new URLSearchParams();
function message(text, error = false) {
  el('message').textContent = error ? `Error: ${text}` : text;
  el('message').classList.toggle('error', error);
  if (error) el('message').scrollIntoView({ block: 'center' });
}
function clearData() {
  el('rows').replaceChildren(); el('results').textContent = ''; el('page').textContent = '';
  el('detail-panel').hidden = true; el('detail-fields').replaceChildren();
  el('normalized-data').textContent = ''; el('raw-data').textContent = '';
  el('previous').disabled = true; el('next').disabled = true;
}
function reset() {ui.clearAccess();
  generation++; clearData(); el('login-panel').hidden = false; el('identity-panel').hidden = true;
  el('events-panel').hidden = true; el('identity').textContent = '';
}
async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) { const error = new Error(body?.error || 'Request failed.'); error.status = response.status; throw error; }
  return body;
}
function handleError(error) {
  if (error.status === 401 || error.status === 403) reset();
  if (error.status === 401) return message('Sign in to continue.');
  message(ui.safeError(error), true);
}
async function inspect(id) {
  const current = ++generation;
  el('detail-panel').hidden = true; el('detail-fields').replaceChildren();
  el('raw-data').textContent = ''; el('normalized-data').textContent = '';
  try {
    const { event } = await request(`/api/events/${encodeURIComponent(id)}`);
    if (current !== generation) return;
    for (const [label, value] of Object.entries({ ID: event.id, Occurred: event.timestamp, Source: event.source, Type: event.type, Received: event.receivedAt, Normalized: event.normalizedAt || 'Pending' })) {
      const term = document.createElement('dt'), description = document.createElement('dd');
      term.textContent = label; description.textContent = value; el('detail-fields').append(term, description);
    }
    el('normalized-data').textContent = event.event ? JSON.stringify(Object.fromEntries(Object.entries(event.event).filter(([key]) => key !== 'rawData')), null, 2) : 'Not yet normalized.';
    el('raw-data').textContent = JSON.stringify(event.rawData, null, 2);
    el('detail-panel').hidden = false; el('detail-panel').focus(); message('Event loaded.');
  } catch (error) { if (current === generation) handleError(error); }
}
async function load() {
  const current = ++generation; clearData(); ui.loading('Loading security events…');
  try {
    const access = await request('/api/access/me');
    if (current !== generation) return;
    ui.applyAccess(access);
    el('login-panel').hidden = true; el('identity-panel').hidden = false;
    el('identity').textContent = `${access.user.displayName} · ${access.roles.join(', ') || 'No role assigned'}`;
    if (!access.permissions.includes('events.read')) { el('events-panel').hidden = true; message('Your account does not have permission to view events.', true); return; }
    const params = new URLSearchParams(activeFilters); params.set('page', String(page));
    const data = await request(`/api/events?${params}`);
    if (current !== generation) return;
    for (const event of data.events) {
      const row = document.createElement('tr');
      for (const value of [event.timestamp.replace('T', ' ').replace(/\.000Z$/, ' UTC').replace(/Z$/, ' UTC'), event.source, event.type, event.severity || 'Unknown', `${event.user || 'Unknown'} / ${event.host || 'Unknown'}`, event.status || 'Unknown']) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      const cell = document.createElement('td'), button = document.createElement('button');
      button.type = 'button'; button.textContent = 'Inspect'; button.setAttribute('aria-label', `Inspect event ${event.id}`);
      button.addEventListener('click', () => inspect(event.id)); cell.append(button); row.append(cell); el('rows').append(row);
    }
    el('events-panel').hidden = false; el('results').textContent = data.events.length ? `${data.events.length} ${data.events.length === 1 ? 'event' : 'events'} on this page.` : 'No events match these filters.';
    el('page').textContent = `Page ${data.page}`; el('previous').disabled = page <= 1; el('next').disabled = !data.hasMore;
    message('Events loaded.');
  } catch (error) { if (current === generation) handleError(error); }
}
el('filters').addEventListener('submit', event => {
  event.preventDefault(); const params = new URLSearchParams();
  try {
    for (const [key, value] of new FormData(event.currentTarget)) if (value.trim()) params.set(key, ['from', 'to'].includes(key) ? new Date(value).toISOString() : value.trim());
    activeFilters = params; page = 1; load();
  } catch { clearData(); message('Enter valid filter dates.', true); }
});
el('clear').addEventListener('click', () => { el('filters').reset(); activeFilters = new URLSearchParams(); page = 1; load(); });
el('previous').addEventListener('click', () => { if (page > 1) { page--; load(); } });
el('next').addEventListener('click', () => { if (page < 2000) { page++; load(); } });
el('login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
  try {
    await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: el('email').value, password: el('password').value }) });
    await load();
  } catch (error) { handleError(error); }
  finally { el('password').value = ''; button.disabled = false; }
});
el('logout').addEventListener('click', async () => {
  reset();
  try { await request('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); message('Signed out.'); }
  catch (error) { handleError(error); }
});
load();
