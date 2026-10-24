// Калькулятор «какую виброплиту взять» — ОРИЕНТИР, не расчёт по СНиП.
// Паспортная «глубина уплотнения» (legacy/items.json) — для влажного песка в идеальных условиях;
// для других материалов слой берём тоньше коэффициентом LAYER_K. Время — по паспортной
// производительности с КПД WORK_EFF (развороты, перекрытие полос, перерывы).
// Не перестраховываемся: берём самую дешёвую машину, которая проходит слой за минимум раз.
// Больше двух одинаковых машин не предлагаем (на сайте нет остатков) — дальше «через менеджера».

export type Material = 'sand' | 'pgs' | 'gravel' | 'soil';
export type Task = 'tile' | 'otmostka' | 'parking' | 'road' | 'trench';

export const MATERIALS: Record<Material, string> = { sand: 'песок', pgs: 'ПГС', gravel: 'щебень', soil: 'грунт' };
export const TASKS: Record<Task, string> = {
  tile: 'плитка, дорожка', otmostka: 'отмостка', parking: 'площадка под авто',
  road: 'дорога, основание', trench: 'траншея, вдоль стен',
};

interface Machine {
  key: string;
  /** Карточка каталога (src/data/plates.ts) */
  plateId: string;
  name: string;
  weight: number;
  /** Паспортная глубина уплотнения, см */
  depth: number;
  /** Паспортная производительность, м²/ч */
  perf: number;
  price: [number, number];
  /** 2 — в парке есть минимум две одинаковые (units ≥ 2) */
  maxQty: 1 | 2;
  reverse?: boolean;
}

export const MACHINES: Record<string, Machine> = {
  m60: { key: 'm60', plateId: 'p60', name: 'Masalta MS60 или Titan VP-65K', weight: 62, depth: 20, perf: 450, price: [30, 30], maxQty: 2 },
  // группа 35–40 руб.: цена каждой модели не подтверждена ❓
  m90: { key: 'm90', plateId: 'p90-140', name: 'Masalta MS 90 кг или MS 100', weight: 90, depth: 30, perf: 600, price: [35, 40], maxQty: 2 },
  m120: { key: 'm120', plateId: 'p90-140', name: 'Titan VP-120K', weight: 120, depth: 35, perf: 516, price: [35, 40], maxQty: 1 },
  m140: { key: 'm140', plateId: 'p90-140', name: 'Masalta MS 140', weight: 140, depth: 38, perf: 616, price: [35, 40], maxQty: 1 },
  m160: { key: 'm160', plateId: 'p160', name: 'Masalta MS 160', weight: 160, depth: 40, perf: 616, price: [60, 60], maxQty: 2 },
  m300: { key: 'm300', plateId: 'p300', name: 'Сплитстоун 309 / Splitstone 300 кг', weight: 300, depth: 50, perf: 616, price: [80, 80], maxQty: 2 },
  m260r: { key: 'm260r', plateId: 'p260r', name: 'Masalta MS 260 (реверсивная)', weight: 260, depth: 50, perf: 650, price: [110, 110], maxQty: 1, reverse: true },
  m430r: { key: 'm430r', plateId: 'p430r', name: 'реверсивная 430 кг, электростарт', weight: 430, depth: 50, perf: 650, price: [140, 140], maxQty: 1, reverse: true },
  m500r: { key: 'm500r', plateId: 'p500r', name: 'реверсивная 500 кг, электростарт', weight: 500, depth: 80, perf: 650, price: [180, 180], maxQty: 2, reverse: true },
  // Вибронога: паспортных данных нет — слой и производительность ориентир
  rammer: { key: 'rammer', plateId: 'r-vibronoga', name: 'вибронога Masalta или 90 кг', weight: 70, depth: 40, perf: 150, price: [60, 60], maxQty: 2 },
};

/** Какие машины разумны под задачу (от лёгкой к тяжёлой): плиту 500 кг на плитку не ставим */
export const TASK_MACHINES: Record<Task, string[]> = {
  tile: ['m60', 'm90', 'm120', 'm140', 'm160'],
  otmostka: ['m90', 'm120', 'm140', 'm160', 'm300'],
  parking: ['m120', 'm140', 'm160', 'm300', 'm260r', 'm500r'],
  road: ['m300', 'm260r', 'm430r', 'm500r'],
  trench: ['rammer'],
};

/** Доля паспортной глубины, которую реально проходит один слой материала (ориентир) */
export const LAYER_K: Record<Material, number> = { sand: 0.8, pgs: 0.75, gravel: 0.65, soil: 0.5 };
/** Проходов по слою: песок уплотняется быстрее всего, грунт — дольше */
export const PASSES: Record<Material, number> = { sand: 3, pgs: 4, gravel: 5, soil: 6 };
/** КПД смены: паспортные м²/ч × WORK_EFF */
export const WORK_EFF = 0.5;
/** Часов работы в сутках аренды — для подсказки «уложитесь в N суток» */
export const HOURS_PER_DAY = 8;

export interface CalcInput { area: number; material: Material; thickness: number; task: Task }

export interface CalcResult {
  machine: Machine;
  qty: 1 | 2;
  layers: number;
  layerCm: number;
  passes: [number, number];
  hours: number;
  days: number;
  /** Большой объём: даже две машины дольше 3 суток — «комбинация через менеджера» */
  bigJob: boolean;
  tips: string[];
}

const layerCap = (m: Machine, mat: Material) => m.depth * LAYER_K[mat];

export function recommend({ area, material, thickness, task }: CalcInput): CalcResult {
  area = Math.max(1, area);
  thickness = Math.max(3, thickness);
  // Самая дешёвая из тех, что пройдут слой за минимальное число раз
  let best: Machine | undefined;
  let bestLayers = Infinity;
  for (const key of TASK_MACHINES[task]) {
    const m = MACHINES[key];
    const layers = Math.ceil(thickness / layerCap(m, material));
    if (layers < bestLayers || (layers === bestLayers && m.price[0] < best!.price[0])) { best = m; bestLayers = layers; }
  }
  const machine = best!;
  const layers = bestLayers;
  const layerCm = Math.round(thickness / layers);
  const nearLimit = layerCm > layerCap(machine, material) * 0.8;
  // Вибронога бьёт сильнее плиты на единицу площади — проходов меньше
  const p = (task === 'trench' ? Math.max(3, PASSES[material] - 2) : PASSES[material]) + (nearLimit ? 1 : 0);
  const passes: [number, number] = [p, p + 2];

  const work = (area * layers * (p + 1)) / (machine.perf * WORK_EFF);
  let hours = Math.max(0.5, Math.round(work * 2) / 2);
  let qty: 1 | 2 = 1;
  let days = Math.ceil(hours / HOURS_PER_DAY);
  if (days > 2 && machine.maxQty === 2) {
    qty = 2;
    hours = Math.max(0.5, Math.round(work) / 2);
    days = Math.ceil(hours / HOURS_PER_DAY);
  }
  const bigJob = days > 3;

  const tips: string[] = [];
  if (material === 'sand' || material === 'pgs') tips.push('Пролейте песок водой перед проходами: сухой не уплотняется, сколько ни трамбуй.');
  if (material === 'gravel') tips.push('Щебень — в два приёма: сначала основная фракция, потом расклинцовка мелкой (5–20 мм) и ещё пара проходов.');
  if (material === 'soil') tips.push('Грунт уплотняется только при подходящей влажности: сжатый в кулаке ком не рассыпается и не липнет. Глину и суглинок лучше брать виброногой.');
  if (layers > 1) tips.push(`Отсыпайте слоями по ${layerCm} см и уплотняйте каждый — толще машина не пробьёт.`);
  if (task === 'tile') tips.push('По уложенной плитке плиту пускают только через полиуретановый коврик — спросите у менеджера.');
  if (task === 'trench') tips.push('Возьмите коврик для виброноги (5 руб.), если рядом плитка, бордюр или гидроизоляция.');
  if (task === 'tile' && material === 'soil') tips.push('Под плитку сам грунт не трамбуют как основание: снимите растительный слой, отсыпьте щебень и песок.');
  if (machine.reverse) tips.push('Реверсивная ходит вперёд и назад — разворачивать 300–500 кг на узкой площадке не придётся.');
  if (machine.weight >= 260) tips.push('Плита 260–500 кг в легковую не помещается: нужен прицеп с трапом или доставка.');
  tips.push('Проходы — внахлёст, перекрывая соседнюю полосу на 5–10 см.');

  return { machine, qty, layers, layerCm, passes, hours, days, bigJob, tips };
}
