// Первый экран: «разрез грунта» на canvas 2D. Слои песок / щебень / грунт с частицами; виброплита
// ездит туда-сюда, под ней слой оседает и окрашивается по шкале плотности (--d0…--d3). Рядом —
// карточка плотномера: коэффициент уплотнения K растёт до 0,98, счётчик проходов, сейсмограф.
// Курсор над грунтом — «щуп плотномера»: глубина, плотность и K в точке.
// Экономно: разрешение ≤ 1 px на CSS-пиксель, пауза вне экрана и во вкладке в фоне,
// prefers-reduced-motion — один статичный кадр.
const hero = document.querySelector<HTMLElement>('[data-soil]');
const cv = hero?.querySelector<HTMLCanvasElement>('canvas.soil');
if (hero && cv) {
  const ctx = cv.getContext('2d')!;
  const sc = hero.querySelector<HTMLCanvasElement>('canvas.seismo');
  const sctx = sc?.getContext('2d');
  const $ = (s: string) => hero.querySelector<HTMLElement>(s);
  const kOut = $('[data-k]'), passOut = $('[data-pass]'), needle = $('[data-needle]'), mark = $('[data-mark]'), probe = $('[data-probe]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Шкала плотности: рыхлый → уплотнён (как --d0…--d3), плюс цвета щебня и грунта
  // Цвета — из CSS (--d0…--d3, --signal): акцент меняется в одном месте, global.css
  let SAND: number[][] = [];
  let SIG = '#ffd000';
  const css = (v: string) => {
    ctx.fillStyle = getComputedStyle(hero).getPropertyValue(v).trim() || '#000';
    const h = ctx.fillStyle as string; // браузер приводит любой цвет к #rrggbb
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const palette = () => { SAND = ['--d0', '--d1', '--d2', '--d3'].map(css); SIG = rgb(css('--signal')); };
  const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const dens = (d: number) => {
    const x = Math.max(0, Math.min(2.999, d * 3)), i = Math.floor(x);
    return mix(SAND[i], SAND[i + 1], x - i);
  };
  const rgb = (c: number[], a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  const CW = 4; // ширина колонки, px
  let W = 0, H = 0, G = 0, y0 = 0, n = 0;
  let d = new Float32Array(0);
  type P = { x: number; f: number; r: number; l: number };
  let grains: P[] = [];
  let px = 0, dir = 1, passes = 0, hold = 0, t = 0, speed = 0;
  let PW = 76; // ширина плиты (на телефоне меньше)
  const seis: number[] = [];
  let probeX = -1, probeY = -1;

  let seed = Math.random() * 9;
  // Рыхлая отсыпка: неровная, но плавная (без «полос» от случайных колонок)
  const loose = (i: number) => 0.05 + 0.04 * Math.sin(i * 0.09 + seed) + 0.025 * Math.sin(i * 0.31 + seed * 2);
  const thick = (i: number) => {
    const k = 1 - d[i];
    return [G * 0.27 * (1 + 0.5 * k), G * 0.31 * (1 + 0.18 * k)]; // песок, щебень: рыхлые — толще
  };
  const surf = (i: number) => { const [a, b] = thick(i); return y0 + G * 0.27 * 1.5 + G * 0.31 * 1.18 - a - b; };

  function layout() {
    palette();
    const r = cv!.getBoundingClientRect();
    const s = Math.min(1, devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv!.width = Math.round(W * s); cv!.height = Math.round(H * s);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    G = H - 74; y0 = H - G;
    PW = W < 600 ? 60 : 80;
    const old = d;
    n = Math.ceil(W / CW) + 1;
    d = new Float32Array(n);
    for (let i = 0; i < n; i++) d[i] = old.length ? old[Math.min(old.length - 1, Math.floor((i / n) * old.length))] : loose(i);
    // Частицы: песчинки (l=0), камни щебня (l=1), вкрапления грунта (l=2)
    grains = [];
    const add = (count: number, l: number, r0: number, r1: number) => {
      for (let k = 0; k < count; k++) grains.push({ x: Math.random() * W, f: Math.random(), r: r0 + Math.random() * (r1 - r0), l });
    };
    add(W * 1.1, 0, 0.8, 1.8); add(W * 0.42, 1, 2.2, 4.6); add(W * 0.18, 2, 1, 2.4);
    speed = Math.max(140, W / 6);
    if (sc && sctx) { const sr = sc.getBoundingClientRect(); sc.width = Math.round(sr.width * s); sc.height = Math.round(sr.height * s); sctx.setTransform(s, 0, 0, s, 0, 0); }
  }

  function avg() {
    let s = 0, c = 0;
    for (let i = Math.floor(n * 0.04); i < n * 0.96; i++) { s += d[i]; c++; }
    return c ? s / c : 0;
  }

  function step(dt: number) {
    t += dt;
    // Каждый проход снимает половину оставшейся «рыхлости» под плитой
    const rate = Math.log(2) / (PW / speed);
    px += dir * speed * dt;
    const lo = PW * 0.6, hi = W - PW * 0.6;
    if (px > hi || px < lo) { px = Math.max(lo, Math.min(hi, px)); dir = -dir; passes++; }
    const a = Math.max(0, Math.floor((px - PW / 2) / CW)), b = Math.min(n - 1, Math.ceil((px + PW / 2) / CW));
    for (let i = a; i <= b; i++) d[i] += (1 - d[i]) * (1 - Math.exp(-rate * dt));
    // Уплотнили до 0,98 — пауза, и «отсыпаем» новый слой
    if (avg() > 0.985) {
      hold += dt;
      if (hold > 2.6) { hold = 0; passes = 0; seed = Math.random() * 9; for (let i = 0; i < n; i++) d[i] = loose(i); }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // Колонки слоёв: песок — цветом шкалы плотности, щебень и грунт темнее
    for (let i = 0; i < n; i++) {
      const x = i * CW, s = surf(i), [a, b] = thick(i);
      ctx.fillStyle = rgb(dens(d[i]), 0.55 + 0.35 * d[i]);
      ctx.fillRect(x, s, CW + 0.5, a + 0.5);
      const g = 58 + 26 * d[i];
      ctx.fillStyle = `rgb(${g},${g - 2},${g - 8})`;
      ctx.fillRect(x, s + a, CW + 0.5, b + 0.5);
      ctx.fillStyle = '#2f251c';
      ctx.fillRect(x, s + a + b, CW + 0.5, H);
    }
    // Частицы: под плитой дрожат, тем сильнее, чем слой рыхлее
    for (const p of grains) {
      const i = Math.min(n - 1, Math.floor(p.x / CW));
      const s = surf(i), [a, b] = thick(i);
      const near = Math.abs(p.x - px) < PW * 0.8 ? (1 - d[i]) * 1.6 : 0;
      const jx = near ? (Math.random() - 0.5) * near : 0, jy = near ? (Math.random() - 0.5) * near : 0;
      let y: number;
      if (p.l === 0) { y = s + p.f * a; ctx.fillStyle = rgb(mix(dens(d[i]), [255, 245, 220], 0.35), 0.7); }
      else if (p.l === 1) { y = s + a + p.f * b; ctx.fillStyle = `rgba(${150 + p.r * 8},${148 + p.r * 8},${140 + p.r * 6},.75)`; }
      else { y = s + a + b + 6 + p.f * (H - s - a - b - 8); ctx.fillStyle = 'rgba(120,92,64,.55)'; }
      ctx.fillRect(p.x + jx - p.r / 2, y + jy - p.r / 2, p.r, p.l === 1 ? p.r * 0.75 : p.r);
    }
    // Волны вибрации под плитой
    const ip = Math.min(n - 1, Math.max(0, Math.floor(px / CW)));
    const sy = surf(ip);
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      const ph = (t * 1.6 + k / 3) % 1;
      ctx.strokeStyle = rgb(SAND[3], 0.35 * (1 - ph));
      ctx.beginPath();
      ctx.ellipse(px, sy + 4, PW * 0.4 + ph * PW * 1.2, 6 + ph * G * 0.55, 0, 0, Math.PI);
      ctx.stroke();
    }
    drawPlate(px, sy - 1 + (reduced ? 0 : Math.sin(t * 160) * 1.2));
    // Щуп плотномера
    if (probeX >= 0) {
      const i = Math.min(n - 1, Math.floor(probeX / CW)), s = surf(i);
      ctx.strokeStyle = SIG; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(probeX, s - 14); ctx.lineTo(probeX, Math.max(s, probeY)); ctx.stroke();
      ctx.fillStyle = SIG;
      ctx.beginPath(); ctx.arc(probeX, Math.max(s, probeY), 3.5, 0, 7); ctx.fill();
    }
  }

  function drawPlate(x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * PW / 66, PW / 66); // ручка всегда позади — оператор идёт за плитой
    const w = 33; // половина ширины в единицах рисунка (66)
    ctx.fillStyle = '#26282a'; ctx.fillRect(-w, -8, 2 * w, 8); // подошва
    ctx.fillStyle = SIG;
    ctx.beginPath(); ctx.moveTo(-w + 4, -8); ctx.lineTo(w - 2, -8); ctx.lineTo(w - 10, -24); ctx.lineTo(-w + 10, -24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1c1d1f'; ctx.fillRect(-14, -42, 30, 18); // двигатель
    ctx.fillStyle = '#c9c4b8'; ctx.fillRect(-10, -48, 16, 7); // бак
    ctx.strokeStyle = '#1c1d1f'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-w + 12, -20); ctx.lineTo(-w - 22, -62); ctx.stroke(); // ручка
    ctx.strokeStyle = SIG; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-w - 26, -66); ctx.lineTo(-w - 16, -60); ctx.stroke();
    ctx.restore();
  }

  function meter() {
    const a = avg();
    const k = 0.8 + 0.18 * a;
    if (kOut) kOut.textContent = k.toFixed(2).replace('.', ',');
    if (passOut) passOut.textContent = String(passes);
    if (needle) needle.style.transform = `rotate(${-110 + ((k - 0.8) / 0.2) * 220}deg)`;
    if (mark) mark.style.left = `${a * 100}%`;
    if (!sc || !sctx) return;
    // Сейсмограф: на уплотнённом грунте плита «подпрыгивает» — амплитуда растёт с плотностью
    const ip = Math.min(n - 1, Math.max(0, Math.floor(px / CW)));
    const amp = 0.18 + 0.7 * d[ip];
    seis.push(Math.sin(t * 95) * amp * (0.75 + Math.random() * 0.5) + (Math.random() - 0.5) * 0.12);
    const sw = sc.clientWidth, sh = sc.clientHeight, max = Math.ceil(sw / 2);
    while (seis.length > max) seis.shift();
    sctx.clearRect(0, 0, sw, sh);
    sctx.strokeStyle = 'rgba(255,255,255,.08)'; sctx.lineWidth = 1;
    sctx.beginPath(); sctx.moveTo(0, sh / 2); sctx.lineTo(sw, sh / 2); sctx.stroke();
    sctx.strokeStyle = SIG; sctx.lineWidth = 1.4;
    sctx.beginPath();
    seis.forEach((v, i) => { const x = sw - (seis.length - i) * 2, y = sh / 2 - v * sh * 0.44; i ? sctx.lineTo(x, y) : sctx.moveTo(x, y); });
    sctx.stroke();
  }

  function showProbe(e: PointerEvent) {
    const r = cv!.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const i = Math.min(n - 1, Math.max(0, Math.floor(x / CW)));
    const s = surf(i), [a, b] = thick(i);
    if (y < s - 20 || !probe) { hideProbe(); return; }
    probeX = x; probeY = y;
    const depth = Math.max(0, y - s);
    const cm = Math.round((depth / G) * 60);
    // Плотность по слою, г/см³ (ориентир для иллюстрации); K — коэффициент уплотнения
    let name = 'песок', de = d[i], rho = 1.5 + 0.25 * de;
    if (depth > a + b) { name = 'грунт'; de = 0.82 + 0.12 * d[i]; rho = 1.6 + 0.2 * de; }
    else if (depth > a) { name = 'щебень'; de = 0.15 + 0.8 * d[i]; rho = 1.55 + 0.45 * de; }
    probe.hidden = false;
    probe.innerHTML = `<b>${name} · ${cm} см</b>ρ ${rho.toFixed(2).replace('.', ',')} г/см³ · K ${(0.8 + 0.18 * de).toFixed(2).replace('.', ',')}`;
    probe.style.transform = `translate(${Math.min(x + 14, W - probe.offsetWidth - 8)}px, ${r.top - hero!.getBoundingClientRect().top + Math.max(s, y) - 54}px)`;
    if (reduced) draw();
  }
  function hideProbe() { probeX = -1; if (probe) probe.hidden = true; if (reduced) draw(); }
  cv.addEventListener('pointermove', showProbe);
  cv.addEventListener('pointerleave', hideProbe);

  layout();
  px = W * 0.3;
  addEventListener('resize', () => { layout(); if (reduced) still(); });

  function still() {
    // Статичный кадр: слева уже уплотнено, справа рыхло, плита посередине
    for (let i = 0; i < n; i++) d[i] = Math.max(0.05, Math.min(1, 1.25 - (i / n) * 1.3));
    px = W * 0.48; passes = 6; t = 0.3;
    for (let k = 0; k < 160; k++) { t += 1 / 60; meter(); }
    draw();
    if (kOut) kOut.textContent = '0,98';
    if (needle) needle.style.transform = 'rotate(87deg)';
  }

  if (reduced) still();
  else {
    let on = false, last = 0, raf = 0;
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0)); // метка rAF бывает раньше performance.now()
      last = now;
      step(dt); draw(); meter();
      raf = requestAnimationFrame(loop);
    };
    const run = (v: boolean) => {
      if (v === on) return;
      on = v;
      if (v) { last = performance.now(); raf = requestAnimationFrame(loop); } else cancelAnimationFrame(raf);
    };
    let visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(visible && !document.hidden); }).observe(hero);
    document.addEventListener('visibilitychange', () => run(visible && !document.hidden));
  }
}
