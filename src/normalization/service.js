const { securityEvent, jsonObject, EventValidationError } = require('../events/model');
class NormalizationError extends EventValidationError {
  constructor() { super(); this.message = 'Unsupported or malformed raw event.'; this.name = 'NormalizationError'; }
}
function normalizeRawEvent(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'format,rawData,source') throw new NormalizationError();
    const raw = jsonObject(input.rawData);
    let mapped;
    if (input.format === 'simulated-flat-v1') {
      mapped = { timestamp: raw.time, type: raw.event_type, sourceIp: raw.src_ip, destinationIp: raw.dst_ip, user: raw.actor, host: raw.device, action: raw.operation, status: raw.outcome, severity: raw.level };
    } else if (input.format === 'simulated-nested-v1') {
      const section = name => {
        const value = raw[name];
        if (value === undefined) return {};
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NormalizationError();
        return value;
      };
      const event = section('event'), network = section('network'), identity = section('identity');
      mapped = { timestamp: event.time, type: event.type, sourceIp: network.source_ip, destinationIp: network.destination_ip, user: identity.user, host: identity.host, action: event.action, status: event.status, severity: event.severity };
    } else throw new NormalizationError();
    if (mapped.severity !== undefined && mapped.severity !== null) {
      if (typeof mapped.severity !== 'string') throw new NormalizationError();
      mapped.severity = mapped.severity.trim().toUpperCase();
    }
    return securityEvent({ ...mapped, source: input.source, rawData: raw, metadata: { normalization: { format: input.format, version: 1 } } });
  } catch { throw new NormalizationError(); }
}
module.exports = { normalizeRawEvent, NormalizationError };
