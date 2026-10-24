// Задачи и материалы — отдельно от калькулятора: их подписи нужны формам заявок на каждой
// странице (scripts/leads.ts), а сам калькулятор грузится только на главной.
export type Material = 'sand' | 'pgs' | 'gravel' | 'soil';
export type Task = 'tile' | 'otmostka' | 'parking' | 'road' | 'trench';

export const MATERIALS: Record<Material, string> = { sand: 'песок', pgs: 'ПГС', gravel: 'щебень', soil: 'грунт' };
export const TASKS: Record<Task, string> = {
  tile: 'плитка, дорожка', otmostka: 'отмостка', parking: 'площадка под авто',
  road: 'дорога, основание', trench: 'траншея, вдоль стен',
};
