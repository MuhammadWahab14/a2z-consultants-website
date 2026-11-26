'use strict';
/** Template helpers (exposed to EJS through app.locals). */
const { images, logos } = require('./content');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const base = (src) => String(src || '').split('/').pop();

/** Path of one WebP rendition. Falls back to the closest available width. */
function imgUrl(src, width = 1200) {
  const m = images[base(src)];
  if (!m) return '';
  const w = m.widths.find((x) => x >= width) || m.widths[m.widths.length - 1];
  return `/img/${m.name}-${w}.webp`;
}

/**
 * Responsive <img> with srcset, intrinsic size (prevents layout shift) and a tiny blurred placeholder.
 * opts: alt, sizes, cls, eager (above the fold), fit (object-fit handled in CSS), style
 */
function pic(src, opts = {}) {
  const m = images[base(src)];
  if (!m) return '';
  const { alt = '', sizes = '100vw', cls = '', eager = false, style = '' } = opts;
  const srcset = m.widths.map((w) => `/img/${m.name}-${w}.webp ${w}w`).join(', ');
  const largest = m.widths[m.widths.length - 1];
  const w = largest; const h = Math.round((m.height / m.width) * largest);
  const bg = m.lqip ? `background-image:url(${m.lqip});background-size:cover;` : '';
  return `<img class="${esc(cls)}" src="${imgUrl(src, 800)}" srcset="${srcset}" sizes="${esc(sizes)}" width="${w}" height="${h}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" style="${bg}${esc(style)}">`;
}

/** Logo <img> from the trimmed logo renditions. */
function logo(name = 'logo-a2z', height = 56, cls = '') {
  const l = logos[name];
  if (!l) return '';
  const s1 = l.sizes.find((s) => s.h === 56); const s2 = l.sizes.find((s) => s.h === 112);
  const h = Math.min(height, 112);
  const w = Math.round(l.ratio * h);
  return `<img class="${esc(cls)}" src="/img/${name}-56.webp" srcset="/img/${name}-56.webp ${s1.w}w, /img/${name}-112.webp ${s2.w}w" sizes="${w}px" width="${w}" height="${h}" alt="${name === 'logo-a2z' ? 'A to Z Consultants' : 'Alif Group'}">`;
}

/** Team photo (320/520 px WebP), square-ish card crop handled in CSS. */
function teamPic(slug, alt = "") {
  return `<img class="tcard__photo" src="/img/team-${slug}-520.webp" srcset="/img/team-${slug}-320.webp 320w, /img/team-${slug}-520.webp 520w" sizes="(min-width: 1100px) 220px, (min-width: 700px) 30vw, 46vw" width="520" height="559" alt="${esc(alt)}" loading="lazy" decoding="async">`;
}

/** Serialises JSON-LD safely for inline <script>. */
const jsonld = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

module.exports = { esc, imgUrl, pic, teamPic, logo, jsonld, base };
