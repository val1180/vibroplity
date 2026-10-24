// Заявки: все формы [data-lead-form] и кнопки [data-lead], открывающие всплывающую форму.
// Доставка — через серверный /send.php (токен бота и адрес CRM только на сервере), как на
// остальных микросайтах: POST { text, hp } → { ok }.

import { TASKS } from '../data/tasks';

const SITE_LABEL = 'Виброплиты.by';

// ---- UTM и источник перехода (как на trambovka.by) ----
(() => {
  const p = new URLSearchParams(location.search);
  try {
    if (p.get('utm_source')) {
      sessionStorage.setItem('utm_source', p.get('utm_source') || '');
      sessionStorage.setItem('utm_medium', p.get('utm_medium') || '');
      sessionStorage.setItem('utm_campaign', p.get('utm_campaign') || '');
    }
    if (!sessionStorage.getItem('referrer')) sessionStorage.setItem('referrer', document.referrer || 'Прямой заход');
  } catch { /* приватный режим — без меток */ }
})();

// Текст уходит в Telegram с parse_mode: HTML — экранируем ввод посетителя
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function utmSuffix(): string {
  let s = '';
  try {
    const src = sessionStorage.getItem('utm_source');
    if (src) {
      s += `\n\n📡 Источник: ${esc(src)}`;
      const med = sessionStorage.getItem('utm_medium');
      if (med) s += ` / ${esc(med)}`;
      const cmp = sessionStorage.getItem('utm_campaign');
      if (cmp) s += `\n🎯 Кампания: ${esc(cmp)}`;
    }
    const ref = sessionStorage.getItem('referrer');
    if (ref && ref !== 'Прямой заход' && !ref.includes(location.hostname)) s += `\n🔗 Реферер: ${esc(ref)}`;
    else if (!src) s += '\n🔗 Переход: Прямой заход / SEO';
  } catch { /* без меток */ }
  return s;
}

async function send(text: string, hp: string): Promise<boolean> {
  try {
    const resp = await fetch('/send.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text + utmSuffix(), hp }),
    });
    if (!resp.ok) return false;
    const data = await resp.json().catch(() => ({}));
    return !!data.ok;
  } catch (e) {
    console.error('Lead send error:', e);
    return false;
  }
}

function goal(name: string) {
  const w = window as unknown as { ym?: Function; gtag?: Function; YM_ID?: number };
  try { if (typeof w.ym === 'function' && w.YM_ID) w.ym(w.YM_ID, 'reachGoal', name); } catch { /* нет метрики */ }
  try { if (typeof w.gtag === 'function') w.gtag('event', name); } catch { /* нет GA */ }
}

document.querySelectorAll<HTMLFormElement>('form[data-lead-form]').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const val = (k: string) => String(f.get(k) || '').trim();
    const phoneInput = form.elements.namedItem('phone') as HTMLInputElement;
    const msg = form.querySelector<HTMLElement>('.msg')!;
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    if (val('phone').replace(/\D/g, '').length < 9) {
      phoneInput.classList.add('bad');
      phoneInput.focus();
      msg.className = 'msg err';
      msg.textContent = 'Укажите телефон, чтобы мы могли перезвонить';
      return;
    }
    phoneInput.classList.remove('bad');

    let text = `🟨 <b>Заявка на виброплиту</b>\n🏷 Сайт: ${SITE_LABEL}\n📝 Форма: ${esc(form.dataset.source || '')}\n\n📱 Телефон: ${esc(val('phone'))}`;
    if (val('name')) text += `\n👤 Имя: ${esc(val('name'))}`;
    const task = val('task') as keyof typeof TASKS;
    text += `\n🔧 Задача: ${task ? TASKS[task] ?? esc(task) : 'подобрать'}`;
    if (val('model')) text += `\n📦 Модель: ${esc(val('model'))}`;
    if (val('area')) text += `\n📐 Площадь: ${esc(val('area'))} м²`;
    if (val('date')) text += `\n📅 Когда: ${esc(val('date'))}`;
    if (val('calc')) text += `\n🧮 Калькулятор: ${esc(val('calc'))}`;
    text += `\n🌐 Страница: ${esc(location.pathname)}`;

    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Отправляем…';
    const ok = await send(text, val('website'));
    btn.disabled = false;
    btn.textContent = label;
    if (ok) {
      msg.className = 'msg ok';
      msg.textContent = '✓ Заявка отправлена — перезвоним в рабочее время';
      goal('lead_sent');
      form.reset();
      const dlg = form.closest('dialog');
      if (dlg) setTimeout(() => dlg.close(), 2200);
    } else {
      msg.className = 'msg err';
      msg.textContent = 'Не отправилось. Позвоните нам или попробуйте ещё раз.';
    }
  });
});

// ---- Всплывающая форма ----
const modal = document.getElementById('leadModal') as HTMLDialogElement | null;
if (modal) {
  const form = modal.querySelector<HTMLFormElement>('form')!;
  const modelLine = document.getElementById('leadModalModel')!;
  document.addEventListener('click', (e) => {
    const trigger = (e.target as Element).closest<HTMLElement>('[data-lead]');
    if (!trigger) return;
    e.preventDefault();
    const { model = '', task = '', calc = '' } = trigger.dataset;
    (form.elements.namedItem('model') as HTMLInputElement).value = model;
    (form.elements.namedItem('calc') as HTMLInputElement).value = calc;
    (form.elements.namedItem('task') as HTMLSelectElement).value = task;
    modelLine.hidden = !model;
    modelLine.textContent = model ? `Выбрано: ${model}` : '';
    form.querySelector('.msg')!.textContent = '';
    modal.showModal();
    goal('lead_open');
  });
  modal.addEventListener('click', (e) => {
    // Клик по подложке: target — сам dialog, но точка вне его рамки (внутренние отступы — тоже dialog)
    const r = modal.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if ((e.target === modal && outside) || (e.target as Element).closest('[data-close]')) modal.close();
  });
}
