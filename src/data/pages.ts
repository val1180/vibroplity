// Страницы задач и классов веса — для меню, подвала, карты сайта и перелинковки.
// Тексты самих страниц — в src/pages/*.astro (свои для этого сайта, не с trambovka.by).
export interface PageLink { slug: string; title: string; short: string }

export const TASK_PAGES: PageLink[] = [
  { slug: 'vibroplita-pod-plitku', title: 'Виброплита под тротуарную плитку', short: 'Под плитку' },
  { slug: 'vibroplita-dlya-otmostki', title: 'Виброплита для отмостки', short: 'Отмостка' },
  { slug: 'vibroplita-dlya-parkovki', title: 'Площадка под авто и парковка', short: 'Парковка' },
  { slug: 'vibroplita-dlya-shchebnya', title: 'Основание дороги и щебень', short: 'Щебень и дорога' },
];

export const CLASS_PAGES: PageLink[] = [
  { slug: 'legkie-vibroplity', title: 'Лёгкие виброплиты до 100 кг', short: 'до 100 кг' },
  { slug: 'srednie-vibroplity', title: 'Средние виброплиты 100–160 кг', short: '100–160 кг' },
  { slug: 'tyazhelye-vibroplity', title: 'Тяжёлые виброплиты 260–500 кг', short: '260–500 кг' },
];
