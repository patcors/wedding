export const BUTTERFLY_COLORS = {
  pink: ['#a76e83', '#e9adbf', '#ffe3eb', '#d999b0'],
  amber: ['#87400a', '#f5a623', '#fff0a3', '#e87d16'],
  blue: ['#07477f', '#009fe9', '#40ccff', '#087bd0'],
  butter: ['#b59a50', '#f3df94', '#fff7cf', '#e5cb7c'],
  purple: ['#8b78aa', '#cbb7e5', '#eee4fb', '#baa3d6'],
  sage: ['#65775d', '#abbc9b', '#e1ead4', '#94aa83'],
  coral: ['#a65e50', '#e99b88', '#ffddd0', '#d98270'],
  turquoise: ['#397e79', '#75bdb5', '#cef0e8', '#58a69f'],
  peach: ['#ac7c50', '#f0bd91', '#ffe7cf', '#dfa578'],
  mulberry: ['#704461', '#ac7296', '#e7c3db', '#945d80'],
} as const;

export type ButterflyColor = keyof typeof BUTTERFLY_COLORS;
export const BUTTERFLY_COLOR_LABELS: Record<ButterflyColor, string> = {
  pink: 'Soft pink', amber: 'Amber', blue: 'Ulysses blue', butter: 'Butter yellow',
  purple: 'Pale purple', sage: 'Sage green',
  coral: 'Soft coral', turquoise: 'Dusty turquoise', peach: 'Peach', mulberry: 'Mulberry',
};
export const BUTTERFLY_COLOR_ORDER: ButterflyColor[] = [
  'pink', 'amber', 'blue', 'butter', 'purple', 'sage', 'coral', 'turquoise', 'peach', 'mulberry',
];
