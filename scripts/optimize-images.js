/**
 * Turns assets-src/* into responsive WebP files in public/img/ and writes content/images.json
 * (a manifest the templates use to build <img srcset>). Also makes trimmed logos, favicons and the OG image.
 *
 *   npm run images
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets-src');
const OUT = path.join(ROOT, 'public', 'img');
const WIDTHS = [480, 800, 1200, 1800];
const LOGOS = new Set(['ChatGPT-Image-May-9-2026-11_42_47-PM.png', 'alif-grpup-hd-logo-e1794301161187.png']);

const base = (f) => f.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {};
  const files = fs.readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !LOGOS.has(f));
  let totalIn = 0; let totalOut = 0;

  for (const f of files) {
    const input = path.join(SRC, f);
    const meta = await sharp(input).metadata();
    totalIn += fs.statSync(input).size;
    const name = base(f);
    const isPng = meta.format === 'png';
    const widths = WIDTHS.filter((w) => w < meta.width);
    if (!widths.length || widths[widths.length - 1] < meta.width) widths.push(Math.min(meta.width, 1800));
    const made = [];
    for (const w of [...new Set(widths)]) {
      const out = path.join(OUT, `${name}-${w}.webp`);
      await sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: isPng ? 88 : 72, effort: 5, alphaQuality: 90 }).toFile(out);
      totalOut += fs.statSync(out).size; made.push(w);
    }
    // tiny blurred placeholder (data URI) used as the background while the real image loads
    const lq = await sharp(input).rotate().resize({ width: 24 }).blur(1).webp({ quality: 40 }).toBuffer();
    manifest[f] = { name, widths: made, width: meta.width, height: meta.height, lqip: `data:image/webp;base64,${lq.toString('base64')}`, alpha: !!meta.hasAlpha };
  }

  // logos: trim transparent padding, export at 2 sizes
  const logos = {};
  for (const f of LOGOS) {
    const input = path.join(SRC, f);
    const trimmed = await sharp(input).trim().toBuffer();
    const meta = await sharp(trimmed).metadata();
    const name = f.startsWith('alif') ? 'logo-alif' : 'logo-a2z';
    const sizes = [];
    for (const h of [56, 112]) {
      const w = Math.round((meta.width / meta.height) * h);
      await sharp(trimmed).resize({ height: h }).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(OUT, `${name}-${h}.webp`));
      await sharp(trimmed).resize({ height: h }).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${name}-${h}.png`));
      sizes.push({ h, w });
    }
    logos[name] = { sizes, ratio: meta.width / meta.height };
  }
  // favicons from the A to Z mark (square crop of the logo on a navy tile)
  const a2z = await sharp(path.join(SRC, 'ChatGPT-Image-May-9-2026-11_42_47-PM.png')).trim().toBuffer();
  const tile = (size) => sharp({ create: { width: size, height: size, channels: 4, background: '#F9FCFF' } })
    .composite([{ input: sharp(a2z).resize({ width: Math.round(size * 0.84), height: Math.round(size * 0.84), fit: 'inside' }).toBuffer(), gravity: 'centre' }]);
  for (const s of [32, 180, 192, 512]) {
    const inputBuf = await sharp(a2z).resize({ width: Math.round(s * 0.84), height: Math.round(s * 0.84), fit: 'inside' }).toBuffer();
    await sharp({ create: { width: s, height: s, channels: 4, background: '#F9FCFF' } }).composite([{ input: inputBuf, gravity: 'centre' }]).png().toFile(path.join(OUT, s === 180 ? 'apple-touch-icon.png' : `icon-${s}.png`));
  }

  // Open Graph / social share image (1200x630): hero photo, navy gradient, title
  const heroName = 'executives-reviewing-last-report-scaled.jpg';
  if (fs.existsSync(path.join(SRC, heroName))) {
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0.2"><stop offset="0" stop-color="#001F3F" stop-opacity="0.97"/><stop offset="0.62" stop-color="#001F3F" stop-opacity="0.80"/><stop offset="1" stop-color="#001F3F" stop-opacity="0.35"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><text x="72" y="140" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="5" fill="#66CCFF" font-weight="700">PART OF THE ALIF GROUP</text><text x="72" y="300" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="800" fill="#ffffff">A to Z Consultants</text><text x="72" y="380" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#CFE8FF">Strategic guidance for every</text><text x="72" y="428" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#CFE8FF">stage of your business</text><text x="72" y="560" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#66CCFF">Business Creation  ·  Business Growth  ·  Managed Exit</text></svg>`);
    await sharp(path.join(SRC, heroName)).resize(1200, 630, { fit: 'cover', position: 'attention' }).composite([{ input: svg }]).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(OUT, 'og-default.jpg'));
  }

  fs.writeFileSync(path.join(ROOT, 'content', 'images.json'), JSON.stringify({ images: manifest, logos }, null, 1));
  console.log(`optimised ${files.length} images: ${(totalIn / 1048576).toFixed(1)} MB in -> ${(totalOut / 1048576).toFixed(1)} MB out (all sizes), logos + favicons + og image written`);
})().catch((e) => { console.error(e); process.exit(1); });
