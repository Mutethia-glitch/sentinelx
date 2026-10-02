const { createHash } = require('node:crypto');

// Historical migrations were applied from both LF and Windows CRLF checkouts.
// Treat ONLY line-ending conversion as equivalent; a changed SQL statement
// (including other whitespace changes) must still fail checksum validation.
// New ledger entries always record the canonical LF hash.
function migrationChecksums(sql) {
  const lf = sql.replace(/\r\n/g, '\n');
  const crlf = lf.replace(/\n/g, '\r\n');
  const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');
  return {
    canonical: hash(lf),
    accepted: [...new Set([hash(lf), hash(crlf)])],
  };
}

module.exports = { migrationChecksums };
