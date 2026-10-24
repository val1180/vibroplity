// Приёмка в браузере: npm run build && npm run preview, затем node tests/e2e.cjs [адрес]
// Нужен Playwright с Chromium (в облачной среде Claude Code он уже стоит).
// Приёмка: форма, калькулятор, reduced-motion. Запросы к /send.php перехватываются.
const BASE = process.argv[2] || 'http://localhost:4321';
const { chromium } = require('playwright');
// Радиокнопки калькулятора скрыты под подписями: выбираем без клика (клик ломает плавная прокрутка)
const pick = (pg, sel) => pg.$eval(sel, (el) => { el.checked = true; el.dispatchEvent(new Event('input', { bubbles: true })); });
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const sent = [];
  await pg.route('**/send.php', async (r) => { sent.push(JSON.parse(r.request().postData())); await r.fulfill({ json: { ok: true } }); });
  await pg.goto(BASE + '/?utm_source=yandex&utm_campaign=test', { waitUntil: 'networkidle' });

  console.log('[форма без телефона]');
  await pg.click('#leadForm button[type=submit]');
  ok((await pg.textContent('#leadForm .msg')).includes('Укажите телефон'), 'ошибка «Укажите телефон»');
  ok(sent.length === 0, 'запрос не ушёл');

  console.log('[калькулятор]');
  const cases = [
    ['tile', 'sand', 10, 20, /62 кг/], ['tile', 'gravel', 20, 80, /120 кг/], ['otmostka', 'pgs', 25, 44, /120 кг/],
    ['parking', 'gravel', 15, 25, /120 кг/], ['parking', 'gravel', 30, 40, /300 кг/], ['road', 'gravel', 40, 600, /Реверсивная 500 кг/],
    ['road', 'gravel', 30, 3000, /300 кг × 2/], ['trench', 'soil', 60, 15, /Вибротрамбовка/],
  ];
  for (const [task, mat, t, area, re] of cases) {
    await pick(pg, `#calc input[name=task][value=${task}]`);
    await pick(pg, `#calc input[name=material][value=${mat}]`);
    await pg.$eval('#c-th', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(t));
    await pg.fill('#c-area-n', String(area));
    const title = await pg.textContent('[data-r=title]');
    const rest = await pg.$$eval('.metrics b', (x) => x.map((e) => e.textContent).join(' | '));
    const big = await pg.isVisible('[data-r=big]');
    ok(re.test(title), `${task}/${mat} ${t} см, ${area} м² → ${title} · ${rest}${big ? ' · БОЛЬШОЙ ОБЪЁМ' : ''}`);
  }

  console.log('[заявка из калькулятора]');
  await pick(pg, '#calc input[name=task][value=otmostka]');
  await pick(pg, '#calc input[name=material][value=pgs]');
  await pg.$eval('#c-th', (el) => { el.value = '25'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await pg.fill('#c-area-n', '44');
  await pg.click('[data-r=btn]');
  ok(await pg.isVisible('#leadModal'), 'всплывающая форма открылась');
  ok((await pg.textContent('#leadModalModel')).includes('120 кг'), 'в форме выбранная модель: ' + (await pg.textContent('#leadModalModel')));
  await pg.click('#modalForm button[type=submit]');
  ok(sent.length === 0, 'без телефона не отправилось');
  await pg.fill('#modalForm-phone', '+375 29 111-22-33');
  await pg.fill('#modalForm-name', 'Тест');
  await pg.click('#modalForm button[type=submit]');
  await pg.waitForTimeout(400);
  ok(sent.length === 1, 'отправлен один запрос');
  const txt = sent[0]?.text || '';
  console.log('\n' + txt.split('\n').map((l) => '        ' + l).join('\n') + '\n');
  ok(txt.includes('+375 29 111-22-33') && txt.includes('Модель:') && txt.includes('Калькулятор:') && txt.includes('отмостка'), 'в заявке телефон, модель, параметры калькулятора, задача');
  ok(txt.includes('Источник: yandex') && sent[0].hp === '', 'UTM и пустая ловушка hp');
  ok((await pg.textContent('#modalForm .msg')).includes('отправлена'), 'сообщение об успехе');

  console.log('[ловушка website]');
  await pg.evaluate(() => document.getElementById('leadModal').close());
  await pg.fill('#leadForm-phone', '+375291234567');
  await pg.$eval('#leadForm input[name=website]', (el) => { el.value = 'http://spam'; });
  await pg.click('#leadForm button[type=submit]');
  await pg.waitForTimeout(300);
  ok(sent[1]?.hp === 'http://spam', 'hp уходит на сервер (send.php отвечает ok и молчит)');

  console.log('[предустановка калькулятора со страницы задачи]');
  await pg.goto(BASE + '/?task=road&material=gravel&t=40#calc', { waitUntil: 'networkidle' });
  ok(/500 кг/.test(await pg.textContent('[data-r=title]')), 'road/gravel/40 из адреса → ' + (await pg.textContent('[data-r=title]')));
  ok(errs.length === 0, 'нет ошибок JS ' + errs.join('; '));

  console.log('[prefers-reduced-motion]');
  const rm = await b.newPage({ viewport: { width: 1440, height: 820 }, reducedMotion: 'reduce' });
  await rm.goto(BASE + '/', { waitUntil: 'networkidle' });
  const a = await rm.$eval('canvas.soil', (c) => c.toDataURL());
  await rm.waitForTimeout(1200);
  const c2 = await rm.$eval('canvas.soil', (c) => c.toDataURL());
  ok(a === c2, 'canvas — статичный кадр');
  const anim = await rm.evaluate(() => document.getAnimations().filter((x) => x.playState === 'running').length);
  ok(anim === 0, 'CSS-анимаций нет: ' + anim);
  ok(await rm.$$eval('.reveal', (x) => x.every((e) => getComputedStyle(e).opacity === '1')), 'блоки видны сразу');
  const norm = await b.newPage({ viewport: { width: 1440, height: 820 } });
  await norm.goto(BASE + '/', { waitUntil: 'networkidle' });
  const n1 = await norm.$eval('canvas.soil', (c) => c.toDataURL()); await norm.waitForTimeout(500);
  ok(n1 !== await norm.$eval('canvas.soil', (c) => c.toDataURL()), 'без reduced-motion canvas анимируется');
  await norm.evaluate(() => scrollTo({ top: 3000, behavior: 'instant' })); await norm.waitForTimeout(300);
  const p1 = await norm.$eval('canvas.soil', (c) => c.toDataURL()); await norm.waitForTimeout(500);
  ok(p1 === await norm.$eval('canvas.soil', (c) => c.toDataURL()), 'вне экрана canvas на паузе');
  await b.close();
})();
