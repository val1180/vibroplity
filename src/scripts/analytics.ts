// Метрика и GA4 — лениво, как на остальных микросайтах: при первом действии посетителя
// или через 8 секунд. ID берутся из data-атрибутов <body> (src/data/site.ts → analytics);
// пустые ID — ничего не грузим.
type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; ym?: ((...a: unknown[]) => void) & { a?: unknown[]; l?: number }; YM_ID?: number };
const w = window as W;
const metrika = Number(document.body.dataset.ym || 0);
const ga = document.body.dataset.ga || '';

let loaded = false;
function load() {
  if (loaded) return;
  loaded = true;
  if (ga) {
    const s = document.createElement('script');
    s.src = `https://www.googletagmanager.com/gtag/js?id=${ga}`;
    s.async = true;
    document.head.append(s);
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag() { w.dataLayer!.push(arguments); };
    w.gtag('js', new Date());
    w.gtag('config', ga, { send_page_view: true });
  }
  if (metrika) {
    // Стандартная заглушка ym: вызовы копятся, пока не загрузится tag.js
    w.ym = w.ym || Object.assign(function ym(...a: unknown[]) { (w.ym!.a = w.ym!.a || []).push(a); }, { l: Date.now() });
    const s = document.createElement('script');
    s.src = `https://mc.yandex.ru/metrika/tag.js?id=${metrika}`;
    s.async = true;
    document.head.append(s);
    w.YM_ID = metrika;
    w.ym(metrika, 'init', { ssr: true, webvisor: true, clickmap: true, accurateTrackBounce: true, trackLinks: true, referrer: document.referrer, url: location.href });
  }
}

if (metrika || ga) {
  ['scroll', 'mousemove', 'touchstart', 'click', 'keydown'].forEach((e) => addEventListener(e, load, { once: true, passive: true }));
  setTimeout(load, 8000);
}
