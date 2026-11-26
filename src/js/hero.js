/* Hero background: a quiet drifting network of points. Pauses off-screen and when motion is reduced. */
export function initHero() {
  const canvas = document.querySelector('.hero__net');
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let w = 0, h = 0, dpr = 1, pts = [], raf = 0, running = false;
  const mouse = { x: -999, y: -999 };

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(24, Math.min(70, Math.round((w * h) / 22000)));
    pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28, r: Math.random() * 1.6 + 0.8 }));
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    const maxD = 150;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      for (let j = i + 1; j < pts.length; j++) {
        const q = pts[j]; const dx = p.x - q.x; const dy = p.y - q.y; const d = dx * dx + dy * dy;
        if (d < maxD * maxD) {
          ctx.strokeStyle = `rgba(160,195,240,${(1 - Math.sqrt(d) / maxD) * 0.35})`;
          ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
      const md = Math.hypot(p.x - mouse.x, p.y - mouse.y);
      ctx.fillStyle = md < 140 ? 'rgba(255,255,255,0.95)' : 'rgba(180,210,250,0.7)';
      ctx.beginPath(); ctx.arc(p.x, p.y, md < 140 ? p.r + 1 : p.r, 0, 6.2832); ctx.fill();
      if (md < 140) { ctx.strokeStyle = `rgba(255,255,255,${(1 - md / 140) * 0.5})`; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
    }
    raf = running ? requestAnimationFrame(frame) : 0;
  }

  const start = () => { if (!running) { running = true; raf = requestAnimationFrame(frame); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  resize();
  addEventListener('resize', resize, { passive: true });
  const hero = canvas.parentElement;
  hero.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; }, { passive: true });
  hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });
  new IntersectionObserver((e) => (e[0].isIntersecting ? start() : stop()), { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
}
