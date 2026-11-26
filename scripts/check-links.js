'use strict';
/**
 * Crawls the site in-process (random port): every page in the sitemap, every internal link, image, script, stylesheet and
 * #anchor must resolve. Exits non-zero on any broken reference. Also checks one <h1> per page and a meta description.
 */
const http = require('http');
const app = require('../server');

const seenPages = new Map(); // path -> html
const problems = [];
let base;

const get = (p) => new Promise((resolve, reject) => {
  http.get(base + p, { headers: { Accept: 'text/html' } }, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
  }).on('error', reject);
});

const attr = (html, re) => Array.from(html.matchAll(re), (m) => m[1]);

(async () => {
  const server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;

  const sitemap = await get('/sitemap.xml');
  const pages = attr(sitemap.body, /<loc>https?:\/\/[^/]+([^<]*)<\/loc>/g);
  const queue = [...new Set([...pages, '/thank-you/'])];
  const assets = new Set();
  const anchors = []; // [fromPage, path, hash]

  while (queue.length) {
    const p = queue.shift();
    if (seenPages.has(p)) continue;
    const r = await get(p);
    if (r.status !== 200) { problems.push(`${p} -> HTTP ${r.status}`); seenPages.set(p, ''); continue; }
    seenPages.set(p, r.body);

    const h1 = (r.body.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) problems.push(`${p}: expected 1 <h1>, found ${h1}`);
    if (!/<meta name="description" content="[^"]{20,}/.test(r.body)) problems.push(`${p}: missing/short meta description`);
    if (!/<link rel="canonical"/.test(r.body)) problems.push(`${p}: missing canonical`);
    for (const img of r.body.matchAll(/<img\b[^>]*>/g)) if (!/\balt="/.test(img[0])) problems.push(`${p}: <img> without alt`);

    const hrefs = attr(r.body, /<a\b[^>]*\shref="([^"]*)"/g);
    for (const raw of hrefs) {
      const href = raw.replace(/&amp;/g, '&');
      if (/^(mailto:|tel:|https?:|javascript:)/.test(href)) { if (/^javascript:/.test(href)) problems.push(`${p}: javascript: link`); continue; }
      const [pathPart, hash] = href.split('#');
      const target = pathPart === '' ? p : pathPart;
      if (hash !== undefined && hash !== '') anchors.push([p, target, hash]);
      if (!seenPages.has(target) && !queue.includes(target)) queue.push(target);
    }
    for (const src of [...attr(r.body, /\ssrc="(\/[^"]*)"/g), ...attr(r.body, /\ssrcset="([^"]*)"/g).flatMap((s) => s.split(',').map((x) => x.trim().split(' ')[0])), ...attr(r.body, /<link[^>]+href="(\/[^"]*)"/g)]) assets.add(src.replace(/&amp;/g, '&'));
  }

  for (const a of assets) {
    const r = await get(a);
    if (r.status !== 200) problems.push(`asset ${a} -> HTTP ${r.status}`);
  }
  for (const [from, target, hash] of anchors) {
    const html = seenPages.get(target);
    if (html == null) continue;
    if (!new RegExp(`\\sid="${hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(html)) problems.push(`${from}: anchor ${target}#${hash} has no matching id`);
  }

  // Legacy redirects and 404 handling
  for (const [from, to] of [['/our-people', '/about/'], ['/careers/jobs-listing/', '/contact/'], ['/about', '/about/']]) {
    const r = await new Promise((res) => http.get(base + from, (x) => { x.resume(); res(x); }));
    if (r.statusCode !== 301 || !String(r.headers.location).endsWith(to)) problems.push(`redirect ${from} expected 301 -> ${to}, got ${r.statusCode} ${r.headers.location}`);
  }
  const nf = await get('/definitely-not-here/');
  if (nf.status !== 404 || !/<h1/.test(nf.body)) problems.push(`404 page not served (status ${nf.status})`);

  server.close();
  console.log(`Checked ${seenPages.size} pages, ${assets.size} assets, ${anchors.length} anchors.`);
  if (problems.length) { console.error(`\n${problems.length} problem(s):\n - ${[...new Set(problems)].join('\n - ')}`); process.exit(1); }
  console.log('All links, images, anchors and redirects OK.');
})().catch((e) => { console.error(e); process.exit(1); });
