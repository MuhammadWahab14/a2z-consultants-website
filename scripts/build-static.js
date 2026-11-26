'use strict';
/**
 * Static export for GitHub Pages (or any static host): renders every page of the Express app to ./dist.
 *
 *   SITE_URL=https://user.github.io/repo node scripts/build-static.js
 *
 * - Root-relative URLs are prefixed with the path of SITE_URL, so the site works under /repo/ as well as at a domain root.
 * - Forms: with STATIC_FORM_ENDPOINT (e.g. a Formspree URL) they post there; without it they open the visitor's email app
 *   with the enquiry pre-filled (mailto). There is no server on static hosting.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://example.github.io/a2z-consultants').replace(/\/+$/, '');
process.env.SITE_URL = SITE_URL;
const ENDPOINT = process.env.STATIC_FORM_ENDPOINT ? new URL(process.env.STATIC_FORM_ENDPOINT.trim()).href : ''; // must be a valid URL
if (ENDPOINT && !ENDPOINT.startsWith('https://')) throw new Error('STATIC_FORM_ENDPOINT must be an https:// URL');
const BASE = new URL(SITE_URL).pathname.replace(/\/+$/, ''); // '' or '/repo'

const app = require('../server');
const { site } = require('../lib/content');

const get = (p) => new Promise((resolve, reject) => {
  http.get(`http://127.0.0.1:${port}${p}`, { headers: { Accept: 'text/html' } }, (res) => {
    const chunks = []; res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
  }).on('error', reject);
});

/* prefix root-relative URLs in HTML attributes */
function rebase(html) {
  if (!BASE) return html;
  html = html.replace(/(\s(?:href|src|action|poster)=")\/(?!\/)/g, `$1${BASE}/`);
  html = html.replace(/(\s(?:image)?srcset=")([^"]*)(")/g, (m, a, v, c) => a + v.replace(/(^|,\s*)\/(?!\/)/g, `$1${BASE}/`) + c);
  return html;
}

/* forms: point at the endpoint, or fall back to mailto (handled in forms.js) */
function staticForms(html) {
  return html.replace(/<form class="form([^"]*)" method="post" action="\/api\/enquiry" data-enquiry/g,
    (m, cls) => `<form class="form${cls}" method="post" action="${ENDPOINT || '#'}" data-enquiry data-static data-thanks="${BASE}/thank-you/" data-mailto="${site.email}"${ENDPOINT ? ` data-endpoint="${ENDPOINT}"` : ''}`);
}

/* Static hosts (GitHub Pages) cannot send headers, so the same policy as server.js goes into a <meta> tag. */
const FORM_ORIGIN = ENDPOINT ? ` ${new URL(ENDPOINT).origin}` : '';
const CSP = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'${FORM_ORIGIN}; frame-src https://maps.google.com https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self'${FORM_ORIGIN}`;
const withCsp = (html) => html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">\n<meta name="referrer" content="strict-origin-when-cross-origin">`);

function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

function copyDir(src, dest, transform) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name); const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d, transform);
    else if (transform && transform(s, d)) continue;
    else fs.copyFileSync(s, d);
  }
}

let port;
(async () => {
  fs.rmSync(dist, { recursive: true, force: true });
  const server = app.listen(0); port = server.address().port;

  // pages: everything in the sitemap + thank-you; the 404 page becomes 404.html
  const sm = (await get('/sitemap.xml')).body.toString();
  // sitemap <loc> values are SITE_URL + route, so stripping SITE_URL gives the app route
  const paths = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].slice(SITE_URL.length) || '/');
  const routes = [...new Set([...paths, '/thank-you/'])];
  for (const r of routes) {
    const res = await get(r);
    if (res.status !== 200) throw new Error(`${r} returned ${res.status}`);
    const html = withCsp(rebase(staticForms(res.body.toString("utf8"))));
    write(path.join(dist, r.replace(/^\//, ''), 'index.html'), html);
  }
  const nf = await get('/this-page-does-not-exist/');
  write(path.join(dist, '404.html'), withCsp(rebase(staticForms(nf.body.toString("utf8")))));

  // generated files
  for (const f of ['sitemap.xml', 'robots.txt', 'manifest.webmanifest']) {
    let body = (await get(`/${f}`)).body.toString('utf8');
    if (f === 'manifest.webmanifest' && BASE) body = body.replace(/"\/img\//g, `"${BASE}/img/`).replace('"start_url":"/"', `"start_url":"${BASE}/"`);
    write(path.join(dist, f), body);
  }
  server.close();

  // assets
  copyDir(path.join(root, 'public'), dist, (src, dest) => {
    if (src.endsWith('site.css') && BASE) { write(dest, fs.readFileSync(src, 'utf8').replace(/url\(\/(?!\/)/g, `url(${BASE}/`)); return true; }
    if (src.endsWith('site.js') && BASE) { write(dest, fs.readFileSync(src, 'utf8').replace(/"\/thank-you\/"/g, `"${BASE}/thank-you/"`)); return true; }
    return false;
  });

  // legacy URLs from the old WordPress/template site -> small redirect pages (static hosts cannot send 301s)
  const legacy = {
    'home-business-consulting': '/', 'landing-page': '/', insights: '/', subscribe: '/contact/', 'our-people': '/about/', 'our-commitments': '/about/',
    offices: '/contact/', careers: '/contact/', faq: '/contact/', 'media-mentions': '/about/', 'awards-recognitions': '/about/',
    'case-studies': '/practice-areas/', 'business-advisory-expertise': '/practice-areas/', 'financial-planning': '/practice-areas/',
    'wealth-management': '/practice-areas/', 'tax-and-estate-planning': '/practice-areas/',
  };
  for (const [from, to] of Object.entries(legacy)) {
    const target = `${SITE_URL}${to}`;
    write(path.join(dist, from, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Redirecting…</title><meta name="robots" content="noindex"><link rel="canonical" href="${target}"><meta http-equiv="refresh" content="0; url=${BASE}${to}"><p>This page has moved. <a href="${BASE}${to}">Continue</a></p></html>`);
  }

  write(path.join(dist, '.nojekyll'), '');
  const count = routes.length;
  console.log(`Static site written to dist/: ${count} pages + 404 + ${Object.keys(legacy).length} redirects. Base path: "${BASE || '/'}". Forms: ${ENDPOINT ? 'endpoint ' + ENDPOINT : 'mailto fallback (no STATIC_FORM_ENDPOINT set)'}.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
