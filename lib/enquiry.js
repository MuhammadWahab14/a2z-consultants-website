'use strict';
/**
 * Form submissions: validation, spam protection (honeypot + minimum fill time), storage (JSONL) and
 * optional email delivery through SMTP (configure in .env). Works with fetch (JSON reply) and plain POST (redirect).
 */
const fs = require('fs');
const path = require('path');
const { forms, site } = require('./content');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'enquiries.jsonl');

const schemas = {
  home: forms.home.fields,
  contact: forms.contact.fields,
  consultation: forms.consultation.steps.flatMap((s) => s.fields),
};

const clean = (v, max = 4000) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+()\d\s.\-]{6,25}$/;

function validate(fields, body) {
  const errors = {}; const values = {};
  for (const f of fields) {
    let v = body[f.name];
    if (f.type === 'checkbox') {
      v = (Array.isArray(v) ? v : v ? [v] : []).map((x) => clean(x, 120)).filter((x) => f.options.includes(x));
      values[f.name] = v; continue;
    }
    if (f.type === 'consent') { values[f.name] = v ? 'yes' : 'no'; continue; }
    v = clean(v, f.type === 'textarea' ? 4000 : 300);
    if (f.type === 'select' && v && !f.options.includes(v)) v = '';
    if (f.required && !v) errors[f.name] = `${f.label} is required.`;
    else if (v && f.type === 'email' && !EMAIL.test(v)) errors[f.name] = 'Enter a valid email address.';
    else if (v && f.type === 'tel' && !PHONE.test(v)) errors[f.name] = 'Enter a valid phone number.';
    values[f.name] = v;
  }
  return { errors, values };
}

let mailer;
function getMailer() {
  if (mailer !== undefined) return mailer;
  mailer = null;
  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = require('nodemailer');
      mailer = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
    } catch (e) { console.warn('SMTP disabled:', e.message); }
  }
  return mailer;
}

async function store(record) {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  await fs.promises.appendFile(FILE, JSON.stringify(record) + '\n');
}

async function notify(record, fields) {
  const m = getMailer();
  if (!m) return;
  const lines = fields.filter((f) => record.values[f.name] && record.values[f.name].length)
    .map((f) => `${f.label}: ${Array.isArray(record.values[f.name]) ? record.values[f.name].join(', ') : record.values[f.name]}`);
  await m.sendMail({
    from: process.env.CONTACT_FROM || `"${site.name} website" <${site.email}>`,
    to: process.env.CONTACT_TO || site.email,
    replyTo: record.values.email || undefined,
    subject: `New ${record.form} enquiry from ${record.values.name || record.values.email || 'website'}`,
    text: `${lines.join('\n')}\n\nReceived: ${record.at}`,
  });
}

async function handleEnquiry(req, res) {
  const wantsJson = (req.get('accept') || '').includes('application/json') || req.is('application/json');
  const done = () => (wantsJson ? res.json({ ok: true, redirect: '/thank-you/' }) : res.redirect(303, '/thank-you/'));
  const body = req.body || {};
  const formId = clean(body.form, 30);
  const fields = schemas[formId];
  if (!fields) return wantsJson ? res.status(400).json({ ok: false, message: 'Unknown form.' }) : res.redirect(303, '/contact/');

  // Bots: filled honeypot or submitted faster than a person could. Pretend success so they learn nothing.
  const started = Number(body.started);
  if (clean(body.website_url) || (started && Date.now() - started < 2500)) return done();

  const { errors, values } = validate(fields, body);
  if (Object.keys(errors).length) {
    if (wantsJson) return res.status(422).json({ ok: false, message: 'Please check the highlighted fields.', errors });
    return res.redirect(303, `/${formId === 'consultation' ? 'get-a-consultation' : formId === 'home' ? '' : 'contact'}/?form_error=1`);
  }

  const record = { at: new Date().toISOString(), form: formId, values, ip: req.ip, ua: clean(req.get('user-agent'), 200) };
  try {
    await store(record);
  } catch (e) {
    console.error('Could not store enquiry:', e);
    return wantsJson ? res.status(500).json({ ok: false, message: 'We could not save your message. Please email or call us.' }) : res.redirect(303, '/contact/?form_error=1');
  }
  notify(record, fields).catch((e) => console.error('Email notification failed:', e.message));
  return done();
}

module.exports = { handleEnquiry, validate, schemas };
