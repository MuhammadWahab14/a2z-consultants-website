/**
 * Copies every image referenced by the site's content files (plus the logos) from the WordPress uploads folder
 * into assets-src/. Run once; `npm run images` then turns assets-src/ into responsive WebP in public/img/.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WP_UPLOADS = 'C:/Users/HP/Local Sites/a2z-consultnat/app/public';
const files = ['home', 'about', 'services', 'stages'].map((n) => path.join(ROOT, 'content', `${n}.json`));
const refs = new Set();
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\/wp-content\/uploads\/[^"\s\\]+/g)) refs.add(m[0]);
}
// logos used by the WordPress header / footer
['/wp-content/uploads/2023/07/ChatGPT-Image-May-9-2026-11_42_47-PM.png', '/wp-content/uploads/2023/07/alif-grpup-hd-logo-e1794301161187.png'].forEach((l) => refs.add(l));

fs.mkdirSync(path.join(ROOT, 'assets-src'), { recursive: true });
let ok = 0; const missing = []; let bytes = 0;
for (const r of [...refs].sort()) {
  const src = path.join(WP_UPLOADS, r);
  if (!fs.existsSync(src)) { missing.push(r); continue; }
  const dest = path.join(ROOT, 'assets-src', path.basename(r));
  fs.copyFileSync(src, dest); ok++; bytes += fs.statSync(dest).size;
}
console.log(`copied ${ok} images (${(bytes / 1048576).toFixed(1)} MB)`);
if (missing.length) console.log('MISSING:\n' + missing.join('\n'));
