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
  hours: 'пн–сб 9:00–18:00 · вс — выходной',
  openingHours: 'Mo-Sa 09:00-18:00', // schema.org
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

