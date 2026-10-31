// Контакты и реквизиты сайта — единственное место, где они заданы.
// Telegram, пункты выдачи и режим работы — общие для микросайтов Стройрента
// (так же на trambovka.by, teplopushka.by, osushitel.by).
// Телефона на сайте пока нет (владелец 25.10: «пока что убери телефон») — связь через заявку и Telegram.
// TODO(владелец): завести ящик info@vibroplity.by или заменить на рабочий адрес.
export const SITE = {
  code: 'vibroplity', // поле `site` в заявке CRM (config/leads.php → sites)
  name: 'Виброплиты.by',
  domain: 'vibroplity.by',
  url: 'https://vibroplity.by',
  telegram: 'https://t.me/erbf11',
  email: 'info@vibroplity.by',
  city: 'Минск',
  hours: 'пн–пт 9:00–18:00 · сб–вс — Домбровская, 10 (сб 9–18, вс 9–15)',
  openingHours: ['Mo-Fr 08:30-18:00', 'Sa 09:00-18:00', 'Su 09:00-15:00'], // schema.org — все пункты вместе: в сб и вс работает Домбровская, 10 (CRM, 31.10)
  points: [
    { name: 'Северный берег', address: 'ул. Автомобилистов, 12', metro: '' },
    { name: 'Центр', address: 'ул. К. Либкнехта, 54', metro: 'ст.м. Ф. Богушевича' },
    { name: 'Кунцевщина', address: 'ул. Домбровская, 10', metro: 'ст.м. Кунцевщина' },
  ],
  // Соседний микросайт — зимние работы (отогреть грунт перед трамбовкой).
  teplopushka: 'https://teplopushka.by',
  // Счётчики — у каждого микросайта свои.
  // TODO(владелец): создать Метрику и GA4 для vibroplity.by и вписать сюда; пусто — не грузятся.
  analytics: { metrika: 0, ga: '' },
} as const;

