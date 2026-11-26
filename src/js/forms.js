/* Enquiry forms: client-side validation, multi-step wizard, fetch submit with graceful fallback to normal POST. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+()\d\s.\-]{6,25}$/;

function fieldError(input, msg) {
  const box = input.closest('.field');
  if (!box) return;
  box.classList.toggle('has-error', !!msg);
  const err = $('.field__err', box);
  if (err) err.textContent = msg || '';
  if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  if (err && msg) { if (!err.id) err.id = `e-${input.id}`; input.setAttribute('aria-describedby', err.id); }
}

function check(input) {
  if (input.type === 'checkbox' || input.name === 'website_url' || input.type === 'hidden') return true;
  const v = input.value.trim();
  const label = ($('label', input.closest('.field')) || {}).textContent || 'This field';
  let msg = '';
  if (input.required && !v) msg = `${label.replace('*', '').trim()} is required.`;
  else if (v && input.type === 'email' && !EMAIL.test(v)) msg = 'Enter a valid email address.';
  else if (v && input.type === 'tel' && !PHONE.test(v)) msg = 'Enter a valid phone number.';
  fieldError(input, msg);
  return !msg;
}

function checkAll(scope) {
  let first = null;
  $$('input, select, textarea', scope).forEach((el) => { if (!check(el) && !first) first = el; });
  if (first) first.focus();
  return !first;
}

function initWizard(form) {
  const panels = $$('.wizard__panel', form);
  const dots = $$('[data-step-dot]', form);
  const bar = $('.wizard__bar i', form);
  const prev = $('[data-prev]', form); const next = $('[data-next]', form); const submit = $('[data-submit]', form);
  let i = 0;
  const show = (n, focus = true) => {
    i = n;
    panels.forEach((p, j) => { p.hidden = j !== n; p.classList.toggle('is-on', j === n); });
    dots.forEach((d, j) => { d.classList.toggle('is-on', j === n); d.classList.toggle('is-done', j < n); });
    bar.style.width = `${((n + 1) / panels.length) * 100}%`;
    prev.hidden = n === 0; next.hidden = n === panels.length - 1; submit.hidden = n !== panels.length - 1;
    if (focus) { const f = $('input:not([type=hidden]), select, textarea', panels[n]); if (f) f.focus({ preventScroll: true }); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };
  next.addEventListener('click', () => { if (checkAll(panels[i])) show(i + 1); });
  prev.addEventListener('click', () => show(i - 1));
  // Enter should advance, not submit early
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && i < panels.length - 1) { e.preventDefault(); next.click(); }
  });
  // On submit-time validation failure, jump to the step that has the error
  form.addEventListener('wizard:error', (e) => {
    const names = Object.keys(e.detail || {});
    const idx = panels.findIndex((p) => names.some((n) => $(`[name="${n}"]`, p)));
    if (idx > -1) show(idx, false);
  });
  show(0, false);
}

/* Static hosting (no server): post to a form service if one is configured, otherwise open the visitor's email app. */
async function sendStatic(form, setStatus) {
  const endpoint = form.dataset.endpoint;
  const fd = new FormData(form);
  ['started', 'website_url'].forEach((k) => fd.delete(k));
  if (endpoint) {
    try {
      const res = await fetch(endpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
      if (res.ok) { location.assign(form.dataset.thanks || '/thank-you/'); return; }
      setStatus('We could not send your message. Please try again, or email or call us.', 'err');
    } catch { setStatus('We could not reach the server. Please check your connection, or email or call us.', 'err'); }
    return;
  }
  const lines = [];
  $$('.field', form).forEach((box) => {
    const named = $('input[name], select[name], textarea[name]', box);
    if (!named) return;
    const label = ($('label, legend', box) || {}).textContent || named.name;
    const checked = $$('input[type=checkbox]:checked', box).map((c) => c.value);
    const val = named.type === 'checkbox' ? checked.join(', ') : named.value.trim();
    if (val) lines.push(`${label.replace('*', '').trim()}: ${val}`);
  });
  const who = fd.get('name') || fd.get('email') || 'website visitor';
  const subject = `Website enquiry (${fd.get('form')}) from ${who}`;
  location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  setStatus(`Your email app should now open with your enquiry ready to send. If nothing opens, email us at ${form.dataset.mailto}.`, 'ok');
}

function initForm(form) {
  const started = $('input[name="started"]', form);
  if (started) started.value = String(Date.now());
  const status = $('.form__status', form);
  const btn = $('button[type="submit"]', form);
  const setStatus = (msg, kind) => { status.textContent = msg || ''; status.className = `form__status${kind ? ` is-${kind}` : ''}`; };

  $$('input, select, textarea', form).forEach((el) => {
    el.addEventListener('blur', () => { if (el.value || el.closest('.field').classList.contains('has-error')) check(el); });
    el.addEventListener('input', () => { if (el.closest('.field').classList.contains('has-error')) check(el); });
  });

  if (form.hasAttribute('data-wizard')) initWizard(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');
    const scope = form.hasAttribute('data-wizard') ? $('.wizard__panel.is-on', form) : form;
    if (!checkAll(scope)) { setStatus('Please correct the highlighted fields.', 'err'); return; }
    if (form.hasAttribute('data-wizard')) { // validate earlier steps too
      const bad = $$('.wizard__panel', form).find((p) => !checkAll(p));
      if (bad) { setStatus('Please complete the required fields in the earlier steps.', 'err'); return; }
    }
    btn.disabled = true; form.classList.add('is-sending');
    if (form.hasAttribute('data-static')) { await sendStatic(form, setStatus); btn.disabled = false; form.classList.remove('is-sending'); return; }
    try {
      const body = new URLSearchParams(new FormData(form));
      const res = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) { location.assign(data.redirect || '/thank-you/'); return; }
      if (data.errors) {
        Object.entries(data.errors).forEach(([name, msg]) => { const el = $(`[name="${name}"]`, form); if (el) fieldError(el, msg); });
        form.dispatchEvent(new CustomEvent('wizard:error', { detail: data.errors }));
      }
      setStatus(data.message || 'Something went wrong. Please try again or call us.', 'err');
    } catch {
      setStatus('We could not reach the server. Please check your connection, or email or call us.', 'err');
    }
    btn.disabled = false; form.classList.remove('is-sending');
  });
}

export function initForms() {
  $$('form[data-enquiry]').forEach(initForm);
  if (new URLSearchParams(location.search).has('form_error')) {
    const s = $('.form__status'); if (s) { s.textContent = 'We could not send your message. Please check the details and try again.'; s.className = 'form__status is-err'; }
  }
}
