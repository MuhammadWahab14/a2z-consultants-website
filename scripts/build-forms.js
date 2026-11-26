'use strict';
/**
 * Curates the three site forms from the extracted WordPress forms (content/forms.json is rewritten in place).
 * Keeps every real question from the original forms; drops layout-only "html"/"step"/honeypot entries and the
 * stray template option, and turns the US-only "State" select into free text so it works for every country.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'content', 'forms.json');
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
if (raw.home) { console.log('forms.json already curated'); process.exit(0); }

const opts = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const f = (name, label, type, extra = {}) => ({ name, label, type, required: false, ...extra });
const countries = opts(raw.consultation.fields.find((x) => x.label === 'Country').options).filter((x) => x !== 'Select');
const stages = opts(raw.consultation.fields.find((x) => x.label === 'Current Stage').options).filter((x) => x !== 'Select');
const capital = opts(raw.consultation.fields.find((x) => /capital/.test(x.label)).options);
const services = opts(raw.consultation.fields.find((x) => x.type === 'checkbox').options).filter((x) => !/capital/i.test(x));

const out = {
  home: {
    fields: [
      f('name', 'Name', 'text', { required: true, placeholder: 'Your name' }),
      f('email', 'Email', 'email', { required: true, placeholder: 'Your email address' }),
      f('phone', 'Phone number', 'tel', { required: true, placeholder: 'Your phone number' }),
      f('company', 'Company name', 'text', { placeholder: 'Your company name' }),
      f('website', 'Website', 'text', { placeholder: 'Your website' }),
      f('message', 'Message', 'textarea', { placeholder: 'How can we help?', rows: 4 }),
    ],
    button: 'Submit',
  },
  contact: {
    intro: raw.contact.intro,
    excerpt: raw.contact.excerpt,
    fields: [
      f('name', 'Name', 'text', { placeholder: 'Your name' }),
      f('email', 'Email', 'email', { required: true, placeholder: 'Your email address' }),
      f('phone', 'Phone number', 'tel', { required: true, placeholder: 'Your phone number' }),
      f('company', 'Company', 'text', { placeholder: 'Company name' }),
      f('reason', 'Reason for contacting', 'text', { placeholder: 'Reason for contacting' }),
      f('subject', 'Subject', 'text', { placeholder: 'Enter here' }),
      f('message', 'Message', 'textarea', { placeholder: 'Tell us about your requirement', rows: 6 }),
    ],
    button: 'Send',
  },
  consultation: {
    intro: raw.consultation.intro,
    excerpt: raw.consultation.excerpt,
    button: 'Request quote',
    steps: [
      { title: 'About you', fields: [
        f('name', 'Name', 'text', { required: true, placeholder: 'Your name' }),
        f('email', 'Email', 'email', { required: true, placeholder: 'Your email address' }),
        f('phone', 'Phone number', 'tel', { required: true, placeholder: 'Your phone number' }),
        f('city', 'City', 'text', { placeholder: 'City' }),
        f('country', 'Country', 'select', { options: countries, placeholder: 'Select country' }),
        f('state', 'State / Region', 'text', { placeholder: 'State or region' }),
      ] },
      { title: 'Your business', fields: [
        f('company', 'Company name', 'text', { placeholder: 'Your company name' }),
        f('website', 'Website', 'text', { placeholder: 'Enter your website' }),
        f('industry', 'Industry / Market', 'text', { placeholder: 'Your industry / market' }),
        f('stage', 'Current stage', 'select', { options: stages, placeholder: 'Select stage' }),
        f('description', 'Business description', 'textarea', { required: true, rows: 5, placeholder: 'Tell us about your business' }),
      ] },
      { title: 'What you need', fields: [
        f('capital', 'How much capital are you raising?', 'select', { options: capital, placeholder: 'Select' }),
        f('services', 'Services required (select all that apply)', 'checkbox', { options: services }),
        f('other', 'Other (please specify below)', 'textarea', { rows: 3 }),
        f('timeline', 'How fast do you need it?', 'textarea', { rows: 3 }),
      ] },
      { title: 'Almost done', fields: [
        f('source', 'How did you find us?', 'text', { placeholder: 'Search, referral, social media…' }),
        f('newsletter', 'May we send you our newsletter?', 'consent', {}),
      ] },
    ],
  },
};
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log('forms curated:', Object.keys(out).join(', '), '| services:', services.length, '| countries:', countries.length);
