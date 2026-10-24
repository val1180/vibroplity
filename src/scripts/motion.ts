// Движение на странице: полоса прогресса «уплотнения», появление блоков, счётчики.
// Без библиотек. При prefers-reduced-motion всё показывается сразу, без анимаций.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasIO = 'IntersectionObserver' in window;

// Появление блоков .reveal; соседи в одной сетке появляются лесенкой
const reveals = document.querySelectorAll<HTMLElement>('.reveal');
if (reduced || !hasIO) {
  reveals.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target as HTMLElement;
      const i = Array.prototype.indexOf.call(el.parentElement?.children ?? [], el);
      el.style.transitionDelay = `${Math.min(i, 6) * 60}ms`;
      el.classList.add('in');
      io.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  reveals.forEach((el) => io.observe(el));
}

// Счётчики: <b data-count="500">500</b> — от нуля, когда появляются на экране
if (!reduced && hasIO) {
  const count = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target as HTMLElement;
      count.unobserve(el);
      const to = Number(el.dataset.count);
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / 1200);
        el.textContent = String(Math.round(to * (1 - (1 - t) ** 3)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => count.observe(el));
}

// Полоса сверху: цвет идёт по шкале плотности по мере прокрутки — страница «уплотняется»
const bar = document.getElementById('densbar');
let ticking = false;
const onScroll = () => {
  ticking = false;
  const max = document.documentElement.scrollHeight - innerHeight;
  if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
};
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();
