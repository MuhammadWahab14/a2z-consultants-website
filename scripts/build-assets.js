'use strict';
/**
 * Production asset build: concatenates src/css/*.css and minifies with lightningcss, bundles src/js/main.js with esbuild,
 * and copies the self-hosted fonts into public/fonts. Output: public/css/site.css, public/js/site.js, public/fonts/*.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'public');
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

function fontFile(pkg, pattern) {
  const dir = path.join(root, 'node_modules', pkg, 'files');
  const f = fs.readdirSync(dir).find((n) => pattern.test(n));
  if (!f) throw new Error(`Font not found in ${pkg}: ${pattern}`);
  return path.join(dir, f);
}

function copyFonts() {
  const dir = path.join(out, 'fonts');
  fs.mkdirSync(dir, { recursive: true });
  const map = {
    'plus-jakarta-sans.woff2': fontFile('@fontsource-variable/plus-jakarta-sans', /^plus-jakarta-sans-latin-wght-normal\.woff2$/),
    'inter.woff2': fontFile('@fontsource-variable/inter', /^inter-latin-wght-normal\.woff2$/),
    'jetbrains-mono-500.woff2': fontFile('@fontsource/jetbrains-mono', /^jetbrains-mono-latin-500-normal\.woff2$/),
  };
  for (const [name, src] of Object.entries(map)) fs.copyFileSync(src, path.join(dir, name));
  console.log('fonts   ', Object.keys(map).join(', '));
}

function buildCss() {
  const { transform } = require('lightningcss');
  const dir = path.join(root, 'src', 'css');
  const css = fs.readdirSync(dir).filter((f) => f.endsWith('.css')).sort().map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const res = transform({
    filename: 'site.css', code: Buffer.from(css), minify: true,
    targets: { chrome: 100 << 16, safari: 15 << 16, firefox: 100 << 16, edge: 100 << 16 },
  });
  fs.mkdirSync(path.join(out, 'css'), { recursive: true });
  fs.writeFileSync(path.join(out, 'css', 'site.css'), res.code);
  console.log('css     ', kb(css.length), '->', kb(res.code.length));
}

async function buildJs() {
  const esbuild = require('esbuild');
  fs.mkdirSync(path.join(out, 'js'), { recursive: true });
  const r = await esbuild.build({
    entryPoints: [path.join(root, 'src', 'js', 'main.js')], bundle: true, minify: true, format: 'iife', target: ['es2020'],
    outfile: path.join(out, 'js', 'site.js'), legalComments: 'none', logLevel: 'warning',
  });
  console.log('js      ', kb(fs.statSync(path.join(out, 'js', 'site.js')).size), r.warnings.length ? `(${r.warnings.length} warnings)` : '');
}

(async () => {
  copyFonts();
  buildCss();
  await buildJs();
  console.log('Build complete.');
})().catch((e) => { console.error(e); process.exit(1); });
