'use strict';
/**
 * Exercises POST /api/enquiry in-process: valid submissions for all three forms, validation errors, honeypot,
 * too-fast bot, unknown form, plain (non-JS) POST redirect and rate limiting. Writes to a temp data file, not data/.
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Point the store at a throw-away dir before the app loads
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a2z-forms-'));
const enquiry = require('../lib/enquiry');
const dataFile = path.join(__dirname, '..', 'data', 'enquiries.jsonl');
const before = fs.existsSync(dataFile) ? fs.readFileSync(dataFile, 'utf8') : null;
const app = require('../server');

let base; let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

function post(body, { json = true } = {}) {
  return new Promise((resolve, reject) => {
    // arrays become repeated keys, like a real multi-checkbox form post
    const data = new URLSearchParams(Object.entries(body).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]]))).toString();
    const req = http.request(base + '/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data), ...(json ? { Accept: 'application/json' } : {}) } }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c));
      res.on('end', () => { const text = Buffer.concat(chunks).toString(); let j = null; try { j = JSON.parse(text); } catch { /* not json */ } resolve({ status: res.statusCode, json: j, headers: res.headers, text }); });
    });
    req.on('error', reject); req.end(data);
  });
}
const old = String(Date.now() - 10000);

(async () => {
  const server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`;

  let r = await post({ form: 'home', started: old, name: 'Test User', email: 'test@example.com', phone: '+971 50 123 4567', message: 'Hello' });
  ok(r.status === 200 && r.json && r.json.ok && r.json.redirect === '/thank-you/', 'home form accepts a valid submission');

  r = await post({ form: 'contact', started: old, email: 'a@b.co', phone: '0501234567', message: 'Hi' });
  ok(r.status === 200 && r.json.ok, 'contact form accepts valid submission (name optional)');

  r = await post({ form: 'consultation', started: old, name: 'A B', email: 'ab@example.com', phone: '+97150000000', country: 'United Arab Emirates', description: 'Trading company', services: ['Business Plan', 'Not a real option'], newsletter: 'yes' });
  ok(r.status === 200 && r.json.ok, 'consultation form accepts valid submission');

  r = await post({ form: 'home', started: old, name: '', email: 'nope', phone: 'abc' });
  ok(r.status === 422 && r.json.errors && r.json.errors.name && r.json.errors.email && r.json.errors.phone, 'invalid input returns 422 with per-field errors');

  r = await post({ form: 'consultation', started: old, name: 'A', email: 'a@b.co', phone: '+9715000000' });
  ok(r.status === 422 && r.json.errors.description, 'consultation requires business description');

  const n0 = (fs.readFileSync(dataFile, 'utf8').match(/\n/g) || []).length;
  r = await post({ form: 'home', started: old, name: 'Bot', email: 'bot@example.com', phone: '+971500000000', website_url: 'http://spam' });
  ok(r.status === 200 && r.json.ok, 'honeypot submission looks successful to the bot');
  r = await post({ form: 'home', started: String(Date.now()), name: 'Fast', email: 'fast@example.com', phone: '+971500000000' });
  ok(r.status === 200 && r.json.ok, 'too-fast submission looks successful to the bot');
  const n1 = (fs.readFileSync(dataFile, 'utf8').match(/\n/g) || []).length;
  ok(n0 === n1, 'honeypot and too-fast submissions are NOT stored');

  r = await post({ form: 'nope', name: 'x' });
  ok(r.status === 400, 'unknown form is rejected');

  r = await post({ form: 'home', started: old, name: 'No JS', email: 'nojs@example.com', phone: '+971500000000' }, { json: false });
  ok(r.status === 303 && r.headers.location === '/thank-you/', 'plain POST (no JavaScript) redirects to /thank-you/');
  r = await post({ form: 'home', started: old, name: '', email: 'x', phone: '1' }, { json: false });
  ok(r.status === 303 && /form_error=1/.test(r.headers.location), 'plain POST with errors redirects back with form_error');

  const stored = fs.readFileSync(dataFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const last = stored.filter((x) => x.values.email === 'ab@example.com')[0];
  ok(last && last.values.services.length === 1 && last.values.services[0] === 'Business Plan', 'unknown checkbox options are dropped');

  let limited = false;
  for (let i = 0; i < 12 && !limited; i++) { const x = await post({ form: 'home', started: old, name: 'R', email: 'r@example.com', phone: '+971500000000' }); if (x.status === 429) limited = true; }
  ok(limited, 'rate limiter kicks in after repeated submissions');

  server.close();
  // clean up the test records so real enquiries are never mixed with test data
  if (before === null) fs.rmSync(dataFile, { force: true }); else fs.writeFileSync(dataFile, before);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `\n${fails} test(s) failed` : '\nAll form tests passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
