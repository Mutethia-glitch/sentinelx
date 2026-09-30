const { AuthError } = require('../auth/errors');

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function invalid(message = 'Invalid investigation note.') {
  throw new AuthError(400, message);
}

function referenceIds(values, label) {
  if (!Array.isArray(values) || values.length > 50 ||
      new Set(values).size !== values.length ||
      values.some(value => typeof value !== 'string' || !UUID.test(value))) {
    invalid(`Provide up to 50 unique ${label} identifiers.`);
  }
  return [...values];
}

function noteInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'alertIds,content,eventIds' ||
      typeof body.content !== 'string' || !body.content.trim() ||
      body.content.length > 4000 || body.content.includes('\0')) {
    invalid();
  }
  return {
    content: body.content.trim(),
    alertIds: referenceIds(body.alertIds, 'alert'),
    eventIds: referenceIds(body.eventIds, 'event'),
  };
}

module.exports = { noteInput, referenceIds };
