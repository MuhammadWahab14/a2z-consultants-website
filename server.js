'use strict';
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const content = require('./lib/content');
const helpers = require('./lib/helpers');
const { handleEnquiry } = require('./lib/enquiry');

const { site, home, about, forms, team, stages, stageById, services, nav, neighbours, stats } = content;
const legal = require('./content/legal.json');

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = (process.env.SITE_URL || site.defaultUrl).replace(/\/+$/, '');
const PUBLIC = path.join(__dirname, 'public');
const IS_PROD = process.env.NODE_ENV === 'production';

/* Asset version = newest build output time, so browsers refetch CSS/JS after a build. */
function assetVersion() {
  try { return Math.floor(Math.max(fs.statSync(path.join(PUBLIC, 'css', 'site.css')).mtimeMs, fs.statSync(path.join(PUBLIC, 'js', 'site.js')).mtimeMs) / 1000).toString(36); } catch { return 'dev'; }
}

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.set('x-powered-by', false);
app.set('strict routing', true);
if (!IS_PROD) app.set('view cache', false);

app.locals = Object.assign(app.locals, helpers, { site, home, about, forms, team, stages, services, nav, stats, legal, baseUrl: BASE_URL });

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'frame-src': ['https://maps.google.com', 'https://www.google.com'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(compression());

/* Static files: fingerprinted-by-query CSS/JS and images/fonts cache for a long time. */
const longCache = { maxAge: '365d', immutable: true };
app.use('/fonts', express.static(path.join(PUBLIC, 'fonts'), longCache));
app.use('/img', express.static(path.join(PUBLIC, 'img'), { maxAge: '30d' }));
app.use('/css', express.static(path.join(PUBLIC, 'css'), { maxAge: IS_PROD ? '365d' : 0 }));
app.use('/js', express.static(path.join(PUBLIC, 'js'), { maxAge: IS_PROD ? '365d' : 0 }));
app.use(express.static(PUBLIC, { maxAge: '1h', index: false }));

app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(express.json({ limit: '64kb' }));

/* ---------------------------------------------------------------- page rendering */
const orgJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  '@id': `${BASE_URL}/#org`,
  name: site.name,
  url: `${BASE_URL}/`,
  logo: `${BASE_URL}/img/logo-a2z-112.png`,
  image: `${BASE_URL}/img/og-default.jpg`,
  description: site.description,
  telephone: site.phone,
  email: site.email,
  address: { '@type': 'PostalAddress', streetAddress: `${site.address.line1}, ${site.address.line2}`, addressLocality: site.address.city, addressCountry: 'AE' },
  geo: { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng },
  areaServed: site.countries,
  parentOrganization: { '@type': 'Organization', name: site.group.name, url: site.group.url },
});

const crumbLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${BASE_URL}${p}` })),
});

function render(res, view, page, data = {}) {
  const status = page.status || 200;
  res.status(status).render('layout', Object.assign({
    view: `pages/${view}`,
    page: Object.assign({ key: view, cta: true, jsonld: [], bodyClass: '' }, page),
    year: new Date().getFullYear(),
    assetVersion: assetVersion(),
  }, data));
}

/* ---------------------------------------------------------------- pages */
app.get('/', (req, res) => {
  const slide0 = home.hero.slides[0];
  const m = content.images[helpers.base(slide0)];
  render(res, 'home', {
    key: 'home', title: site.name, path: '/', nav: '/', cta: false, bodyClass: 'is-home',
    description: site.description,
    preload: m ? helpers.imgUrl(slide0, 1200) : undefined,
    jsonld: [orgJsonLd()],
  });
});

app.get('/about/', (req, res) => render(res, 'about', {
  key: 'about', title: 'Who We Are', path: '/about/', nav: '/about/',
  description: 'A to Z Consultants provides end-to-end consultancy supporting businesses through creation, growth and managed exit, with deep regulatory and commercial expertise.',
  jsonld: [crumbLd([['Home', '/'], ['Who We Are', '/about/']])],
}));

app.get('/practice-areas/', (req, res) => render(res, 'practice-areas', {
  key: 'practice-areas', title: 'Practice Areas', path: '/practice-areas/', nav: '/practice-areas/',
  description: `Explore ${services.length} advisory services across business creation, growth and managed exit, from business setup and UBO/AML compliance to valuation and transaction advisory.`,
  jsonld: [crumbLd([['Home', '/'], ['Practice Areas', '/practice-areas/']])],
}));

stages.forEach((stage) => {
  app.get(stage.url, (req, res) => render(res, 'stage', {
    key: `stage-${stage.id}`, title: stage.name, path: stage.url, nav: '/practice-areas/',
    description: `${stage.name} (${stage.code}): ${stage.intro}`.slice(0, 300),
    image: undefined,
    jsonld: [crumbLd([['Home', '/'], ['Practice Areas', '/practice-areas/'], [stage.name, stage.url]])],
  }, { stage }));
});

services.forEach((service) => {
  app.get(service.url, (req, res) => render(res, 'service', {
    key: `service-${service.slug}`, title: service.title, path: service.url, nav: '/practice-areas/',
    description: `${service.title}: ${service.summary} ${service.body[1] || ''}`.replace(/\s+/g, ' ').trim().slice(0, 300),
    jsonld: [
      crumbLd([['Home', '/'], ['Practice Areas', '/practice-areas/'], [service.stageInfo.name, service.stageInfo.url], [service.title, service.url]]),
      { '@context': 'https://schema.org', '@type': 'Service', name: service.title, description: service.summary, provider: { '@id': `${BASE_URL}/#org` }, areaServed: site.countries, url: `${BASE_URL}${service.url}` },
    ],
  }, { service, nb: neighbours(service) }));
});

app.get('/contact/', (req, res) => render(res, 'contact', {
  key: 'contact', title: 'Contact', path: '/contact/', nav: '/contact/', cta: false,
  description: 'Contact A to Z Consultants in Dubai for strategic business advisory support across business creation, growth and managed exit.',
  jsonld: [crumbLd([['Home', '/'], ['Contact', '/contact/']])],
}));

app.get('/get-a-consultation/', (req, res) => render(res, 'consultation', {
  key: 'consultation', title: 'Get a Consultation', path: '/get-a-consultation/', cta: false,
  description: 'Tell us about your business and request a strategic consultation with A to Z Consultants. Our advisors will get in touch.',
  jsonld: [crumbLd([['Home', '/'], ['Get a Consultation', '/get-a-consultation/']])],
}));

app.get('/privacy-policy/', (req, res) => render(res, 'legal', {
  key: 'privacy', title: 'Privacy Policy', path: '/privacy-policy/', cta: false,
  description: 'How A to Z Consultants collects, uses and protects your personal information.',
}, { doc: legal.privacy }));

app.get('/terms-of-use/', (req, res) => render(res, 'legal', {
  key: 'terms', title: 'Terms of Use', path: '/terms-of-use/', cta: false,
  description: 'The terms that apply when you use the A to Z Consultants website.',
}, { doc: legal.terms }));

app.get('/thank-you/', (req, res) => render(res, 'thank-you', {
  key: 'thank-you', title: 'Thank You', path: '/thank-you/', noindex: true, cta: false,
  description: 'Thank you for contacting A to Z Consultants.',
}));

/* ---------------------------------------------------------------- forms */
const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, message: 'Too many submissions. Please try again in a few minutes or call us.' },
});
app.post('/api/enquiry', enquiryLimiter, handleEnquiry);

/* ---------------------------------------------------------------- SEO files */
const indexable = () => [
  ['/', 1.0], ['/about/', 0.8], ['/practice-areas/', 0.9],
  ...stages.map((s) => [s.url, 0.8]),
  ...services.map((s) => [s.url, 0.7]),
  ['/contact/', 0.7], ['/get-a-consultation/', 0.8], ['/privacy-policy/', 0.2], ['/terms-of-use/', 0.2],
];
app.get('/sitemap.xml', (req, res) => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const body = indexable().map(([p, pr]) => `  <url><loc>${BASE_URL}${p}</loc><lastmod>${lastmod}</lastmod><priority>${pr.toFixed(1)}</priority></url>`).join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
});
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /thank-you/\n\nSitemap: ${BASE_URL}/sitemap.xml\n`);
});
app.get('/manifest.webmanifest', (req, res) => {
  res.type('application/manifest+json').send(JSON.stringify({
    name: site.name, short_name: 'A to Z', description: site.description, start_url: '/', display: 'standalone',
    background_color: '#001F3F', theme_color: '#001F3F',
    icons: [{ src: '/img/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png' }],
  }));
});

/* ---------------------------------------------------------------- legacy URLs (old WordPress / template site) */
const legacy = {
  '/home-business-consulting/': '/', '/landing-page/': '/', '/insights/': '/', '/subscribe/': '/contact/',
  '/our-people/': '/about/', '/our-commitments/': '/about/', '/offices/': '/contact/', '/careers/': '/contact/',
  '/faq/': '/contact/', '/media-mentions/': '/about/', '/awards-recognitions/': '/about/',
  '/case-studies/': '/practice-areas/', '/business-advisory-expertise/': '/practice-areas/',
  '/financial-planning/': '/practice-areas/', '/wealth-management/': '/practice-areas/', '/tax-and-estate-planning/': '/practice-areas/',
};
Object.entries(legacy).forEach(([from, to]) => {
  app.get(from, (req, res) => res.redirect(301, to));
  app.get(from.replace(/\/$/, ''), (req, res) => res.redirect(301, to));
});
app.get(/^\/(our-people|careers|case-studies|business-advisory-expertise)\/.+/, (req, res) => {
  res.redirect(301, legacy[`/${req.path.split('/')[1]}/`] || '/');
});
/* Trailing-slash normalisation for known pages (e.g. /about -> /about/) */
const known = new Set(['/about', '/practice-areas', '/contact', '/get-a-consultation', '/privacy-policy', '/terms-of-use', '/thank-you',
  ...stages.map((s) => s.url.replace(/\/$/, '')), ...services.map((s) => s.url.replace(/\/$/, ''))]);
app.use((req, res, next) => {
  if (req.method === 'GET' && known.has(req.path)) {
    const q = req.url.slice(req.path.length);
    return res.redirect(301, `${req.path}/${q}`);
  }
  next();
});

/* ---------------------------------------------------------------- 404 + errors */
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, message: 'Not found' });
  render(res, '404', { key: '404', title: 'Page not found', path: req.path, noindex: true, status: 404, cta: false, description: 'The page you were looking for could not be found.' });
});
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ ok: false, message: 'Something went wrong. Please try again or call us.' });
  res.status(500).type('text/plain').send('Something went wrong. Please try again later.');
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`A to Z Consultants site running at http://localhost:${PORT}`));
}
module.exports = app;
