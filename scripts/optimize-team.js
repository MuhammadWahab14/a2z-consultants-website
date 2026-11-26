'use strict';
/** Team photos: assets-src/team/<slug>.jpg -> public/img/team-<slug>-{320,520}.webp (npm run team-images) */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const src = path.join(__dirname, '..', 'assets-src', 'team');
const out = path.join(__dirname, '..', 'public', 'img');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const files = fs.readdirSync(src).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  for (const f of files) {
    const slug = path.parse(f).name;
    for (const w of [320, 520]) {
      await sharp(path.join(src, f)).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(out, `team-${slug}-${w}.webp`));
    }
  }
  console.log(`optimised ${files.length} team photos`);
})().catch((e) => { console.error(e); process.exit(1); });
