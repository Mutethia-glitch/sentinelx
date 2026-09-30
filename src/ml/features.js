const PIPELINE_VERSION = '1.0.0';
const DEFAULT_WINDOW_SECONDS = 900;
const FEATURE_NAMES = Object.freeze([
  'userLoginCount', 'userFailedLoginCount', 'sourceIpEventCount',
  'hostEventCount', 'eventCount', 'utcHour', 'utcDayOfWeek'
]);

function generateFeatures(records, { windowSeconds = DEFAULT_WINDOW_SECONDS } = {}) {
  if (!Array.isArray(records)) throw new TypeError('Records must be an array.');
  if (!Number.isSafeInteger(windowSeconds) || windowSeconds <= 0 ||
      !Number.isSafeInteger(windowSeconds * 1000)) {
    throw new TypeError('Window seconds must be a positive safe integer in milliseconds.');
  }
  const ids = new Set();
  const events = records.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new TypeError('Each record must be an object.');
    }
    for (const field of ['recordId', 'timestamp', 'type', 'action', 'status']) {
      if (typeof record[field] !== 'string' || !record[field].trim()) {
        throw new TypeError('Required event fields must be nonempty strings.');
      }
    }
    const time = Date.parse(record.timestamp);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== record.timestamp) {
      throw new TypeError('Timestamp must be a canonical UTC ISO timestamp.');
    }
    if (ids.has(record.recordId)) throw new TypeError('Record IDs must be unique.');
    ids.add(record.recordId);
    for (const field of ['user', 'host', 'sourceIp']) {
      if (record[field] !== null &&
          (typeof record[field] !== 'string' || !record[field].trim())) {
        throw new TypeError('Identity fields must be nonempty strings or explicit null.');
      }
    }
    // Copy only consumed fields: research labels and future model outputs cannot leak in.
    return { recordId: record.recordId, timestamp: record.timestamp, time,
      user: record.user, host: record.host, sourceIp: record.sourceIp,
      login: record.type === 'authentication' && record.action === 'login',
      failed: record.status === 'failed' };
  }).sort((a, b) => a.time - b.time ||
    (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0));

  const logins = new Map(), failures = new Map(), sources = new Map(), hosts = new Map();
  function change(map, key, delta) {
    if (key === null) return;
    const count = (map.get(key) || 0) + delta;
    if (count === 0) map.delete(key);
    else map.set(key, count);
  }
  function track(event, delta) {
    change(sources, event.sourceIp, delta);
    change(hosts, event.host, delta);
    if (event.login) {
      change(logins, event.user, delta);
      if (event.failed) change(failures, event.user, delta);
    }
  }
  const rows = [];
  let start = 0, index = 0;
  while (index < events.length) {
    const current = events[index];
    const cutoff = current.time - windowSeconds * 1000;
    while (start < index && events[start].time < cutoff) track(events[start++], -1);
    let end = index;
    while (end < events.length && events[end].time === current.time) {
      const event = events[end++], date = new Date(event.time);
      rows.push({ recordId: event.recordId, timestamp: event.timestamp, features: {
        userLoginCount: logins.get(event.user) || 0,
        userFailedLoginCount: failures.get(event.user) || 0,
        sourceIpEventCount: sources.get(event.sourceIp) || 0,
        hostEventCount: hosts.get(event.host) || 0,
        eventCount: index - start,
        utcHour: date.getUTCHours(), utcDayOfWeek: date.getUTCDay()
      } });
    }
    // Add the timestamp cohort after extraction so tied events never count each other.
    for (let i = index; i < end; i++) track(events[i], 1);
    index = end;
  }
  return { pipelineVersion: PIPELINE_VERSION, windowSeconds,
    featureNames: [...FEATURE_NAMES], rows };
}

module.exports = { PIPELINE_VERSION, DEFAULT_WINDOW_SECONDS, FEATURE_NAMES, generateFeatures };
