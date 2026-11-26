# A to Z Consultants: Node.js website

A standalone rebuild of the A to Z Consultants website: same content, entirely new design.
Express + EJS templates, hand-written CSS/JS (no framework), self-hosted fonts, optimised WebP images.
The live WordPress site is **not touched** by this project.

## Run it

```powershell
npm install
npm run build        # bundles CSS/JS, copies fonts into public/
npm start            # http://localhost:3000
```

`npm run dev` restarts the server on file changes. After editing anything in `src/`, run `npm run build` again.

## Test it

```powershell
npm test             # crawls every page/link/image/anchor + exercises all form paths
npm run check:links  # link crawler only
npm run test:forms   # form tests only
```

## Where things live

| Path | What it is |
| --- | --- |
| `content/*.json` | **All site text.** `home.json`, `about.json`, `stages.json`, `services.json`, `forms.json`, `legal.json`, `site.json` (phone, email, address). Edit these to change copy. |
| `views/pages/*.ejs` | Page templates (home, about, practice areas, stage, service, contact, consultation, legal, thank-you, 404) |
| `views/partials/*.ejs` | Header (mega menu), footer, form fields, page hero, icon sprite |
| `src/css/*.css`, `src/js/*.js` | Styles and behaviour (built to `public/css/site.css`, `public/js/site.js`) |
| `lib/enquiry.js` | Form validation, spam checks, storage, optional email |
| `server.js` | Routes, security headers, sitemap/robots/manifest, legacy redirects, 404 |
| `content/team.json`, `assets-src/team/` | Leadership team (copied from alifgroups.com/about); `npm run team-images` regenerates the photos |
| `assets-src/` → `public/img/` | Original photos and the optimised WebP sizes (`npm run images` regenerates) |
| `content/pages/` | Raw extract of the old WordPress pages, kept for reference only (not served). The one-time migration scripts that produced `content/*.json` were removed (see git history before the audit commit); the JSON files are now the source of truth |

## Forms

All three forms (home, contact, 4-step consultation) post to `/api/enquiry`.
Submissions are validated, spam-checked (hidden honeypot + minimum fill time + rate limit) and appended to `data/enquiries.jsonl`.
To also receive them by email, copy `.env.example` to `.env` and fill in the `SMTP_*` and `CONTACT_*` values.
Without JavaScript the forms still work (plain POST, redirect to `/thank-you/`).

## Configuration (`.env`)

`PORT`, `SITE_URL` (used for canonical URLs, sitemap and social cards), `CONTACT_TO`, `CONTACT_FROM`, `SMTP_HOST/PORT/SECURE/USER/PASS`.

## Deploying

Needs Node 20+. Set `NODE_ENV=production` and `SITE_URL`, run `npm ci && npm run build && npm start` behind a reverse proxy (HTTPS).
Shared hosting such as InfinityFree **cannot** run Node.js; this needs a Node host (VPS, Render, Railway, Fly.io, etc.).

## Content notes for review

- Template/demo content from the original theme (team profiles, case studies, careers, awards, FAQ, offices, insights, wealth/tax pages) was **not** carried over; those old URLs redirect (301) to the nearest real page.
- Home statistics (10 years, 110 customers, 20+ specialists) and the "4.9 Customer Reviews" badge come from the original template: confirm they are accurate.
- Privacy Policy and Terms of Use were unfinished theme text; `content/legal.json` contains a drafted replacement that **needs legal review** before launch.

## GitHub Pages

GitHub Pages serves static files only, so `npm run build:static` renders every page to `dist/` and the workflow in
`.github/workflows/pages.yml` publishes it on every push to `main`.
Preview locally exactly as Pages serves it: `SITE_URL=https://you.github.io/repo node scripts/build-static.js` then `node scripts/serve-static.js /repo`.

There is no server on Pages, so forms work like this:
- **Default:** submitting opens the visitor's email app with the enquiry pre-filled (to the address in `content/site.json`).
- **Better:** create a form on a service such as Formspree, then add a repository **variable** named `FORM_ENDPOINT` (Settings → Secrets and variables → Actions → Variables) with its URL. Forms then post there and show the thank-you page.

Old WordPress URLs become small redirect pages (static hosting cannot send real 301s).
