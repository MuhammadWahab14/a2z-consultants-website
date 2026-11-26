'use strict';
/**
 * Loads the JSON content files once and exposes the derived structures the templates need
 * (stages with their services, navigation, breadcrumbs, prev/next, image manifest).
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'content');
const load = (name) => JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));

const site = load('site');
const home = load('home');
const about = load('about');
const forms = load('forms');
const stagesRaw = load('stages');
const servicesRaw = load('services');
const { images, logos } = load('images');

const services = servicesRaw.map((s) => ({ ...s, url: `/practice-areas/${s.slug}/` }));
const stages = stagesRaw.map((st) => {
  const list = services.filter((s) => s.stage === st.id).sort((a, b) => a.order - b.order);
  return { ...st, url: `/${st.slug}/`, services: list };
});
const stageById = Object.fromEntries(stages.map((s) => [s.id, s]));
services.forEach((s) => { s.stageInfo = stageById[s.stage]; });

const nav = [
  { label: 'Home', url: '/' },
  { label: 'Practice Areas', url: '/practice-areas/', mega: true },
  { label: 'Who We Are', url: '/about/' },
  { label: 'Contact', url: '/contact/' },
];

function neighbours(service) {
  const list = service.stageInfo.services;
  const i = list.findIndex((s) => s.slug === service.slug);
  return { prev: list[(i - 1 + list.length) % list.length], next: list[(i + 1) % list.length] };
}

/* Home page: link every highlighted card to its service page (matched by title), and build the quick-link chips. */
const norm = (t) => String(t).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
const bySlug = Object.fromEntries(services.map((s) => [s.slug, s]));
const findService = (title) => {
  const n = norm(title);
  if (/^purchase price allocation/.test(n)) return bySlug['purchase-price-allocation-fair-value-measurement-ifrs-13'];
  return services.find((s) => norm(s.title) === n) || services.find((s) => norm(s.title).startsWith(n) || n.startsWith(norm(s.title))) || null;
};
home.stages.tabs.forEach((tab) => tab.cards.forEach((c) => { const s = findService(c.title); c.url = s ? s.url : '/practice-areas/'; }));
home.chips = ['business-setup-advisory', 'feasibility-studies-market-assessment', 'accounting-systems-implementation', 'ultimate-beneficial-owner-ubo-services', 'aml-cft-services']
  .map((slug) => bySlug[slug]).filter(Boolean)
  .map((s) => ({ label: s.title.replace('Ultimate Beneficial Owner (UBO) Services', 'UBO Services').replace('Feasibility Studies & Market Assessment', 'Feasibility & Market Assessment'), url: s.url }));

const stats = { stages: stages.length, services: services.length, countries: site.countries.length };

module.exports = { site, home, about, forms, stages, stageById, services, nav, neighbours, stats, images, logos };
