'use strict';
/** Preview ./dist the way GitHub Pages serves it (under the repo sub-path). Usage: node scripts/serve-static.js [base] [port] */
const http = require('http');
const fs = require('fs');
const path = require('path');

const base = (process.argv[2] || '/a2z-consultants-website').replace(/\/+$/, '');
const port = Number(process.argv[3]) || 4000;
const dist = path.join(__dirname, '..', 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith(base + '/') && p !== base) { res.writeHead(404); return res.end('Not under base path (like GitHub Pages)'); }
  p = p.slice(base.length) || '/';
  let file = path.join(dist, p);
  if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { Location: `${base}${p}/` }); return res.end(); }
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': types['.html'] }); return res.end(fs.readFileSync(path.join(dist, '404.html'))); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Static preview: http://localhost:${port}${base}/`));
