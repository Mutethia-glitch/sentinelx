const fs = require('node:fs');
const path = require('node:path');
const FILES = {
  '/events': ['index.html', 'text/html; charset=utf-8'],
  '/events/': ['index.html', 'text/html; charset=utf-8'],
  '/events/events.js': ['events.js', 'text/javascript; charset=utf-8'],
  '/events/events.css': ['events.css', 'text/css; charset=utf-8'],
};
function eventPage(req, res) {
  if (!Object.hasOwn(FILES, req.url)) return false;
  const file = FILES[req.url];
  if (!file) return false;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end(); return true; }
  res.setHeader('Content-Type', file[1]);
  try { res.end(fs.readFileSync(path.join(__dirname, '../../frontend/events', file[0]))); }
  catch { res.statusCode = 503; res.end('Event page unavailable.'); }
  return true;
}
module.exports = { eventPage };
