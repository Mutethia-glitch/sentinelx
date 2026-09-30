const WEBHOOK_SCHEMA_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 2000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 5000;
const DISABLED = Object.freeze({ status: 'disabled' });
const UNAVAILABLE = Object.freeze({ status: 'unavailable' });
const DELIVERED = Object.freeze({ status: 'delivered' });

function readConfiguration(env) {
  const value = env.SENTINELX_EXTERNAL_WEBHOOK_URL;
  if (value === undefined || value === null || value === '') return { status: 'disabled' };
  if (typeof value !== 'string' || value.trim() !== value) return { status: 'unavailable' };
  try {
    const url = new URL(value);
    const token = env.SENTINELX_EXTERNAL_WEBHOOK_TOKEN;
    const timeoutText = env.SENTINELX_EXTERNAL_WEBHOOK_TIMEOUT_MS;
    const timeoutMs = timeoutText === undefined || timeoutText === '' ? DEFAULT_TIMEOUT_MS : Number(timeoutText);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
        typeof token !== 'string' || token.length < 16 || token.length > 4096 || token.includes('\0') ||
        !Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
      return { status: 'unavailable' };
    }
    return { status: 'ready', url: url.toString(), token, timeoutMs };
  } catch { return { status: 'unavailable' }; }
}

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid integration clock.');
  return date.toISOString();
}

function eventPayload(saved, now = () => new Date()) {
  const event = saved?.event;
  if (!saved?.id || !event?.timestamp || !event?.source || !event?.type) throw new TypeError('Invalid stored event.');
  return {
    schemaVersion: WEBHOOK_SCHEMA_VERSION,
    eventType: 'sentinelx.security_event',
    emittedAt: iso(typeof now === 'function' ? now() : now),
    event: {
      id: saved.id,
      timestamp: event.timestamp,
      receivedAt: saved.receivedAt ?? null,
      normalizedAt: saved.normalizedAt ?? null,
      source: event.source,
      type: event.type,
      severity: event.severity ?? null,
      sourceIp: event.sourceIp ?? null,
      destinationIp: event.destinationIp ?? null,
      user: event.user ?? null,
      host: event.host ?? null,
      action: event.action ?? null,
      status: event.status ?? null,
    },
  };
}

function externalWebhook({ env = process.env, fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  const config = readConfiguration(env);
  const state = config.status === 'ready' && typeof fetchImpl !== 'function' ? 'unavailable' : config.status;
  return Object.freeze({
    status: state,
    async publishEvent(saved) {
      if (state === 'disabled') return DISABLED;
      if (state !== 'ready') return UNAVAILABLE;
      try {
        const response = await fetchImpl(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${config.token}`,
          },
          body: JSON.stringify(eventPayload(saved, now)),
          redirect: 'error',
          signal: AbortSignal.timeout(config.timeoutMs),
        });
        if (response?.body && typeof response.body.cancel === 'function') {
          try { await response.body.cancel(); } catch {}
        }
        return response?.ok ? DELIVERED : UNAVAILABLE;
      } catch { return UNAVAILABLE; }
    },
  });
}

module.exports = { WEBHOOK_SCHEMA_VERSION, DEFAULT_TIMEOUT_MS, externalWebhook, eventPayload };
