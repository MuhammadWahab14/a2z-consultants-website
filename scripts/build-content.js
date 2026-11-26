/**
 * One-off content builder: turns the raw WordPress extraction (content/pages/*.json) into the clean,
 * editable data files the site renders from (content/*.json).
 *
 *   node scripts/build-content.js
 *
 * After this has run, content/*.json is the source of truth: edit those files, not the raw extraction.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'content', 'pages');
const OUT = path.join(ROOT, 'content');
const read = (name) => JSON.parse(fs.readFileSync(path.join(RAW, `${name}.json`), 'utf8'));
const write = (name, data) => fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 2) + '\n');

const strip = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const unent = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#8211;/g, '–').replace(/&#8217;/g, '’').replace(/&quot;/g, '"').trim();
const slugOf = (p) => p.replace(/\/+$/, '').split('/').pop();
const imgName = (src) => (src || '').split('/').pop();
const paragraphs = (html) => (String(html).match(/<p>[\s\S]*?<\/p>/g) || []).map((p) => strip(p));

/* ---------------------------------------------------------------- stages & services */
const hub = read('practice-areas');
const stageDefs = [
  { id: 'creation', slug: 'business-creation', page: 'business-creation', n: '01', name: 'Business Creation', code: 'The Launchpad', icon: 'rocket' },
  { id: 'growth', slug: 'business-growth', page: 'business-growth', n: '02', name: 'Business Growth', code: 'The Engine Room', icon: 'chart' },
  { id: 'exit', slug: 'managed-exit', page: 'managed-exit', n: '03', name: 'Managed Exit', code: 'The Harvest', icon: 'flag' },
];

// the practice-areas hub lists the cards of each stage in order under three H2 headings
const hubStages = []; let cur = null;
hub.blocks.forEach((b) => {
  if (b.type === 'heading' && /^0\d\s/.test(b.text)) { cur = { heading: b.text, intro: '', cards: [] }; hubStages.push(cur); }
  else if (cur && b.type === 'text' && !cur.intro) cur.intro = strip(b.html);
  else if (cur && b.type === 'card' && b.title && !/^If you do not see/i.test(b.title)) cur.cards.push({ title: unent(b.title).replace(/:$/, ''), summary: b.text });
});

const stages = []; const services = [];
stageDefs.forEach((sd, si) => {
  const hs = hubStages[si];
  const stagePage = read(sd.page);
  // lead text lives in the excerpt of every service page of this stage; take the first service's
  const memberTitles = hs.cards.map((c) => c.title);
  stages.push({ ...sd, intro: hs.intro, tagline: stagePage.excerpt, serviceCount: memberTitles.length });
});

// service pages: match the hub cards to pages by title
const allPages = fs.readdirSync(RAW).filter((f) => f.startsWith('practice-areas__')).map((f) => read(f.replace(/\.json$/, '')));
const byTitle = new Map(allPages.map((p) => [unent(p.title).replace(/:$/, '').toLowerCase(), p]));
const norm = (t) => unent(t).replace(/:$/, '').toLowerCase();

hubStages.forEach((hs, si) => {
  const st = stageDefs[si];
  hs.cards.forEach((c, order) => {
    const page = byTitle.get(norm(c.title)) || allPages.find((p) => norm(p.title).startsWith(norm(c.title).slice(0, 24)));
    if (!page) throw new Error('No page for service: ' + c.title);
    const cards = page.blocks.filter((b) => b.type === 'card' && b.text && !b.title).map((b) => b.text);
    const bg = (page.blocks.find((b) => b.type === 'background') || {}).src || '';
    const ex = page.excerpt_html || '';
    services.push({
      slug: slugOf(page.path), stage: st.id, order: order + 1, title: unent(page.title).replace(/:$/, ''),
      summary: c.summary, tagline: strip((ex.match(/<h2>([\s\S]*?)<\/h2>/) || [])[1] || ''),
      body: cards, heroImage: bg, lead: ex,
    });
  });
});

// stage-level lead (headline, paragraphs, key solutions, outcome) comes from the excerpt shared by the stage's services
stages.forEach((st) => {
  const first = services.find((s) => s.stage === st.id);
  const ex = first.lead;
  st.tagline2 = strip((ex.match(/<h2>([\s\S]*?)<\/h2>/) || [])[1] || '');
  st.headline = strip((ex.match(/<h4>([\s\S]*?)<\/h4>/) || [])[1] || '');
  st.paragraphs = paragraphs(ex.replace(/<h4>Key Solutions:?<\/h4>[\s\S]*$/, ''));
  st.keySolutions = (ex.match(/<li>([\s\S]*?)<\/li>/g) || []).map(strip);
  st.outcome = strip(((ex.match(/<h4>\s*The Outcome:?\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/) || [])[1]) || '');
  st.heroImage = first.heroImage;
});
services.forEach((s) => { delete s.lead; });
write('stages', stages);
write('services', services);

/* ---------------------------------------------------------------- home */
const home = read('home');
const H = home.blocks;
const after = (pred, start = 0) => H.findIndex((b, i) => i >= start && pred(b));
const heroB = H.find((b) => b.type === 'hero_headline');
const heroBtn = H.find((b) => b.type === 'button');
const firmIdx = after((b) => b.type === 'heading' && b.text === 'Our Firm');
const firmText = H[firmIdx + 1];
const firmImg = H.slice(firmIdx).find((b) => b.type === 'image');
const specIdx = after((b) => b.type === 'heading' && b.text === 'Our Specialization');
const specList = H.slice(specIdx).find((b) => b.type === 'list');
const approachIdx = after((b) => b.type === 'heading' && /Our Approach/.test(b.text));
const approachBg = H.slice(approachIdx - 4, approachIdx).find((b) => b.type === 'background') || H.slice(specIdx, approachIdx).filter((b) => b.type === 'background').pop();
const whyIdx = after((b) => b.type === 'heading' && b.text === 'Why Choose Our Advisory');
const whyText = H.slice(whyIdx).find((b) => b.type === 'text');
const whyImg = H.slice(whyIdx).find((b) => b.type === 'image');
const spans = H.slice(whyIdx).filter((b) => b.type === 'heading' && b.level === 'span').slice(0, 9);
const statTexts = H.slice(whyIdx).filter((b) => b.type === 'text').slice(1, 4);
const stats = [0, 1, 2].map((i) => ({ value: spans[i * 2].text, label: spans[i * 2 + 1].text, text: strip(statTexts[i].html) }));
const valIdx = after((b) => b.type === 'heading' && b.text === 'Our Values');
const valCards = H.slice(valIdx).filter((b) => b.type === 'card').slice(0, 6).map((c) => ({ title: c.title, text: c.text }));
const valBg = H.slice(valIdx - 3, valIdx + 1).find((b) => b.type === 'background');
const gsIdx = after((b) => b.type === 'heading' && b.text === 'Get started');
const phone = H.find((b) => b.type === 'button' && /^T:/.test(b.text));
const email = H.find((b) => b.type === 'button' && /^E:/.test(b.text));
const addr = H.find((b) => b.type === 'button' && /Suite 1002/.test(b.text));
const rating = H.slice(gsIdx).filter((b) => b.type === 'heading' && b.level === 'span');

// the "service tabs" in the home page: three stages with three highlighted services each
const tabs = [];
H.forEach((b, i) => { if (b.type === 'heading' && b.level === 'h3' && /\((The Launchpad|The Engine Room|The Harvest)\)/.test(b.text)) {
  const cards = []; let j = i + 1; while (H[j] && H[j].type === 'card') { cards.push({ title: H[j].title, text: H[j].text }); j++; }
  const img = H.slice(j, j + 3).find((x) => x.type === 'image');
  tabs.push({ title: b.text, cards, image: img ? img.src : '' });
} });
const stageSlides = H.filter((b) => b.type === 'background' && b.slideshow).map((b) => b.src);
const stageImgs = [18, 21, 24].map((i) => H[i].src);   // the three stage photos used on the home page

write('home', {
  hero: { before: heroB.before, rotating: heroB.rotating, sub: H.find((b) => b.type === 'heading' && b.level === 'h5').text, cta: heroBtn.text, slides: stageSlides },
  firm: { label: 'Our Firm', html: firmText.html, image: firmImg.src, imageAlt: firmImg.alt || 'Business growth' },
  stages: { label: 'Services', title: 'To meet your needs', sub: unent(H.find((b) => b.type === 'heading' && b.level === 'span').text), images: stageImgs, tabs },
  specialization: { label: 'Our Specialization', html: H[specIdx + 1].html, list: specList.items.map((i) => i.text) },
  approach: { title: 'Our Approach & Values', image: approachBg ? approachBg.src : '' },
  why: { label: 'Why Choose Our Advisory', title: unent(H[whyIdx + 1].text), html: whyText.html, image: whyImg.src, stats },
  values: { label: 'Our Values', title: unent(H[valIdx + 1].text), image: valBg ? valBg.src : '', cards: valCards },
  getStarted: { label: 'Get started', title: unent(H[gsIdx + 1].text), image: H.slice(gsIdx).find((b) => b.type === 'image').src, lines: ['We', 'are', 'better', 'together.'], text: strip(H.slice(gsIdx).filter((b) => b.type === 'text')[0].html) },
  contact: { phone: phone.text.replace(/^T:\s*/, '').trim(), email: email.text.replace(/^E:\s*/, '').trim(), address: addr.text.trim(), mapUrl: addr.url },
  reviews: { rating: (rating.find((r) => /^\d\.\d$/.test(r.text)) || {}).text || '4.9', label: 'Customer Reviews' },
});

/* ---------------------------------------------------------------- about */
const about = read('about');
const A = about.blocks;
const aTexts = A.filter((b) => b.type === 'text').map((b) => b.html);
const aLists = A.filter((b) => b.type === 'list');
const aCards = A.filter((b) => b.type === 'card').map((c) => ({ title: c.title, text: c.text }));
const aBg = A.filter((b) => b.type === 'background').map((b) => b.src);
const aHeads = A.filter((b) => b.type === 'heading').map((b) => unent(b.text));
write('about', {
  title: 'About', excerpt: about.excerpt, intro: aTexts[0],
  expertise: { label: aLists[0].items[0].text, title: aHeads[0], html: aTexts[1], image: aBg[0] },
  believe: { label: aLists[1].items[0].text, title: aHeads[1], html: aTexts[2], image: aBg[1] },
  approach: { title: aHeads[2], html: aTexts[3], image: aBg[2] },
  purpose: { label: aLists[2].items[0].text, title: aLists[3].items[0].text, paragraphs: aTexts.slice(4, 8).map(strip), image: aBg[3] },
  lifecycle: { title: aHeads[3], html: aTexts[8], cards: aCards },
  excellence: { label: aLists[4].items[0].text, items: strip(aTexts[9]).split('•').map((s) => s.trim()).filter(Boolean) },
});

/* ---------------------------------------------------------------- forms */
const contact = read('contact');
const cf = contact.blocks.find((b) => b.type === 'form');
const consult = read('get-a-consultation');
const gf = consult.blocks.find((b) => b.type === 'form');
if (false) write('forms', {
  contact: { intro: strip(contact.blocks.find((b) => b.type === 'text').html), excerpt: contact.excerpt, fields: cf.fields, button: cf.button },
  consultation: { intro: strip(consult.blocks.find((b) => b.type === 'text').html), excerpt: consult.excerpt, fields: gf.fields, button: gf.button },
});

console.log(JSON.stringify({ stages: stages.map((s) => [s.id, s.serviceCount, s.keySolutions.length]), services: services.length, tabs: tabs.length, stats: stats.map((s) => s.value), values: valCards.length, aboutCards: aCards.length, expertiseImg: aBg[0], homeStageImgs: stageImgs }, null, 0));
