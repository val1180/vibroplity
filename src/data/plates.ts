// Парк виброплит и вибротрамбовок — каталог на главной и страницах классов веса.
// Источник: основной сайт Стройрента (val1180/stroyrent), database/seeds/offers-seed-2026-09-05.json
// (категории 27 «Виброплиты» и 130 «Вибротрамбовки»); характеристики по классам веса —
// database/seeds/legacy/items.json. Одна карточка = одна ценовая группа CRM.
//
// ❓ = данных нет или привязка к модели — ориентир (список — CLAUDE.md, «Проверить до запуска»).
// `units` — сколько единиц в парке: на сайт НЕ выводим (только «в наличии»), калькулятор
// по нему решает, можно ли предложить две одинаковые машины.

export type Kind = 'forward' | 'reverse' | 'rammer';
export type Group = 'light' | 'medium' | 'heavy';

export interface Plate {
  /** Имя фото: src/assets/plates/<id>.webp (нет файла — рисуется силуэт, см. PlateArt.astro) */
  id: string;
  title: string;
  /** Вес на карточке и шкале */
  weight: string;
  kind: Kind;
  group: Group;
  models: string[];
  /** Цена за сутки, руб. (строка — у группы 35–40 цена каждой модели не подтверждена ❓) */
  price: string;
  priceFrom: number;
  depth?: string;
  plate?: string;
  perf?: string;
  power?: string;
  fuel?: string;
  /** Для чего — одна строка на карточке */
  use: string;
  units: number;
}

export const PLATES: Plate[] = [
  {
    id: 'p-scheppach', title: 'Лёгкая виброплита', weight: 'лёгкая', kind: 'forward', group: 'light',
    models: ['Scheppach HP 1100S'], price: '20', priceFrom: 20,
    // ❓ характеристик в каталоге нет
    use: 'Песок под плитку на дорожке, мелкий ремонт. Характеристики уточнит менеджер.',
    units: 1,
  },
  {
    id: 'p60', title: 'Виброплита 60 кг', weight: '≈ 60 кг', kind: 'forward', group: 'light',
    models: ['Masalta MS60', 'Titan VP-65K'], price: '30', priceFrom: 30,
    depth: 'до 20 см', plate: '50×36 см', perf: '450 м²/ч', power: '4,8 л.с.', fuel: '1,2 л/ч',
    use: 'Садовые дорожки, песчаная подушка под тротуарную плитку.',
    units: 11,
  },
  {
    id: 'p90-140', title: 'Виброплиты 90–140 кг', weight: '90–140 кг', kind: 'forward', group: 'medium',
    models: ['Masalta MS 90 кг', 'Masalta MS 100', 'Titan VP-120K', 'Masalta MS 140'],
    // ❓ в CRM одна группа «35–40»; в старом каталоге 90 кг = 35, 120 кг = 40, 140 кг = 50
    price: '35–40', priceFrom: 35,
    depth: 'до 30–38 см', plate: '53×50 – 55×50 см', perf: '516–616 м²/ч', power: '5,7–6,5 л.с.', fuel: '1,4 л/ч',
    use: 'Плитка во дворе, отмостка, подушка под фундамент.',
    units: 7,
  },
  {
    id: 'p-vs246', title: 'Виброплита Сплитстоун', weight: 'средняя', kind: 'forward', group: 'medium',
    models: ['Сплитстоун VS-246 E12'], price: '50', priceFrom: 50,
    // ❓ характеристик в каталоге нет
    use: 'Отмостка и площадки. Вес и глубину уплотнения уточнит менеджер.',
    units: 1,
  },
  {
    id: 'p160', title: 'Виброплита 160 кг', weight: '160 кг', kind: 'forward', group: 'medium',
    models: ['Masalta MS 160'], price: '60', priceFrom: 60,
    depth: 'до 40 см', plate: '55×50 см', perf: '616 м²/ч', power: '6,5 л.с.',
    use: 'Площадка под машину, отмостка, щебень под заезд.',
    units: 3,
  },
  {
    id: 'p300', title: 'Виброплита 300 кг', weight: '300 кг', kind: 'forward', group: 'heavy',
    models: ['Сплитстоун 309', 'Splitstone 300 кг'], price: '80', priceFrom: 80,
    depth: 'до 50 см', plate: '55×50 см', perf: '616 м²/ч', power: '6,5 л.с.',
    use: 'Щебёночное основание, парковка, засыпка котлована слоями.',
    units: 5,
  },
  {
    id: 'p260r', title: 'Реверсивная Masalta MS 260', weight: '≈ 260–300 кг', kind: 'reverse', group: 'heavy',
    models: ['Masalta MS 260'], price: '110', priceFrom: 110,
    // ❓ характеристики — по классу «300 кг реверсивная» старого каталога
    depth: 'до 50 см', plate: '90×60 см', perf: '650 м²/ч', power: '6,6 л.с.', fuel: '3,2 л/ч',
    use: 'Основание дороги и площадки, работа в стеснённых местах — ходит вперёд и назад.',
    units: 1,
  },
  {
    id: 'p430r', title: 'Реверсивная 430 кг', weight: '430 кг', kind: 'reverse', group: 'heavy',
    models: ['Бензиновая реверсивная, электростарт'], price: '140', priceFrom: 140,
    depth: 'до 50 см', plate: '89×67 см', perf: '650 м²/ч', power: '6,6 л.с.', fuel: '3,2 л/ч',
    use: 'Дорожное основание, щебень крупной фракции, большие площадки.',
    units: 1,
  },
  {
    id: 'p500r', title: 'Реверсивная 500 кг', weight: '500 кг', kind: 'reverse', group: 'heavy',
    models: ['Бензиновая реверсивная, электростарт'], price: '180', priceFrom: 180,
    depth: 'до 80 см', plate: '89×67 см', perf: '650 м²/ч', power: '6,6 л.с.', fuel: '3,2 л/ч',
    use: 'Толстые слои щебня и грунта, основание под асфальт, обратная засыпка.',
    units: 6,
  },
];

export interface Rammer { id: string; title: string; models: string[]; price: string; priceFrom: number; use: string }

export const RAMMERS: Rammer[] = [
  {
    id: 'r-vibronoga', title: 'Вибротрамбовка («вибронога»)', models: ['Masalta', 'Вибронога 90 кг'],
    price: '60', priceFrom: 60,
    use: 'Траншеи, приямки, засыпка вдоль стен и фундаментов — уплотняет полосу около 30 см.',
  },
  {
    id: 'r-mat', title: 'Коврик для вибротрамбовки', models: ['Защитный коврик'], price: '5', priceFrom: 5,
    use: 'Подкладывают под башмак, чтобы не повредить плитку, бордюр или гидроизоляцию.',
  },
];

export const GROUP_LABEL: Record<Group, string> = { light: 'Лёгкие', medium: 'Средние', heavy: 'Тяжёлые' };
export const KIND_LABEL: Record<Kind, string> = { forward: 'Прямоходная', reverse: 'Реверсивная', rammer: 'Вибронога' };
export const MIN_PRICE = Math.min(...PLATES.map((p) => p.priceFrom));
