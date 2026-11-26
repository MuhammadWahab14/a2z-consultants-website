/* A to Z Consultants: site behaviour. Vanilla JS, progressive enhancement. */
import { initForms } from './forms.js';
import { initHero } from './hero.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- header: stuck state, mega menu, mobile menu ---------- */
function initHeader() {
  const hdr = $('[data-hdr]');
  if (!hdr) return;
  const dock = $('.dock');
  const onScroll = () => {
    const y = window.scrollY;
    hdr.classList.toggle('is-stuck', y > 24);
    if (dock) dock.classList.toggle('is-scrolled', y > 600);
  };
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  const toggle = $('.nav__toggle', hdr);
  const setMega = (open) => {
    hdr.classList.toggle('mega-open', open);
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
  };
  if (toggle) {
    toggle.addEventListener('click', () => setMega(!hdr.classList.contains('mega-open')));
    document.addEventListener('click', (e) => { if (!hdr.contains(e.target)) setMega(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setMega(false); closeMenu(); } });
    hdr.addEventListener('mouseleave', () => setMega(false));
    $$('.mega a', hdr).forEach((a) => a.addEventListener('click', () => setMega(false)));
  }

  const burger = $('.burger');
  const menu = $('#mobile-menu');
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.hidden = true; document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu');
  }
  if (burger && menu) {
    burger.addEventListener('click', () => {
      const open = menu.hidden;
      menu.hidden = !open; document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open)); burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    $$('a', menu).forEach((a) => a.addEventListener('click', closeMenu));
    matchMedia('(min-width: 981px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });
  }

  const top = $('.dock__top');
  if (top) top.addEventListener('click', () => scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
}

/* ---------- reveal on scroll + count-up numbers ---------- */
function initReveal() {
  const items = $$('.reveal');
  const counters = $$('[data-count]');
  const count = (el) => {
    const end = Number(el.dataset.count);
    if (reduced || !end) { el.textContent = end; return; }
    const t0 = performance.now(); const dur = 1400;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); counters.forEach(count); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      $$('[data-count]', e.target).forEach(count);
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  items.forEach((el) => io.observe(el));
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { count(e.target); cio.unobserve(e.target); } });
  }, { threshold: 0.4 });
  counters.filter((el) => !el.closest('.reveal')).forEach((el) => cio.observe(el));
}

/* ---------- stage tabs (keyboard accessible) ---------- */
function initTabs() {
  $$('[data-tabs]').forEach((root) => {
    const tabs = $$('[role="tab"]', root);
    const panels = $$('[role="tabpanel"]', root);
    const select = (i, focus) => {
      tabs.forEach((t, j) => { const on = i === j; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      panels.forEach((p, j) => { const on = i === j; p.hidden = !on; p.classList.toggle('is-on', on); });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        const k = e.key; const n = tabs.length;
        if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); select((i + 1) % n, true); }
        else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); select((i - 1 + n) % n, true); }
        else if (k === 'Home') { e.preventDefault(); select(0, true); }
        else if (k === 'End') { e.preventDefault(); select(n - 1, true); }
      });
    });
    // open the tab named in the URL hash, e.g. /#panel-growth
    const m = location.hash.match(/^#(?:panel-|tab-)(\w+)/);
    if (m) { const i = tabs.findIndex((t) => t.id === `tab-${m[1]}`); if (i > -1) select(i); }
  });
}

/* ---------- rotating hero phrase ---------- */
function initRotator() {
  const el = $('.rot');
  if (!el || reduced) return;
  let words; try { words = JSON.parse(el.dataset.rotate); } catch { return; }
  if (!words || words.length < 2) return;
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    el.classList.add('is-out');
    setTimeout(() => { i = (i + 1) % words.length; el.textContent = words[i]; el.classList.remove('is-out'); }, 420);
  }, 3200);
}

/* ---------- hero slideshow ---------- */
function initSlides() {
  const slides = $$('.hero__slide');
  if (slides.length < 2 || reduced) return;
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    slides[i].classList.remove('is-on');
    i = (i + 1) % slides.length;
    slides[i].classList.add('is-on');
  }, 6500);
}

/* ---------- smooth in-page anchors (offset handled by scroll-padding) ---------- */
function initAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    const target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    history.pushState(null, '', a.getAttribute('href'));
    if (target.hasAttribute('tabindex') || /^(H[1-6]|SECTION)$/.test(target.tagName)) target.setAttribute('tabindex', '-1'), target.focus({ preventScroll: true });
  });
}

const ready = (fn) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn());
ready(() => {
  initHeader(); initReveal(); initTabs(); initRotator(); initSlides(); initAnchors(); initForms(); initHero();
});
