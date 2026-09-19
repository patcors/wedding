export const BUTTERFLY_COLORS = {
  pink: ['#a76e83', '#e9adbf', '#ffe3eb', '#d999b0'],
  amber: ['#87400a', '#f5a623', '#fff0a3', '#e87d16'],
  blue: ['#07477f', '#009fe9', '#40ccff', '#087bd0'],
  butter: ['#b59a50', '#f3df94', '#fff7cf', '#e5cb7c'],
  purple: ['#8b78aa', '#cbb7e5', '#eee4fb', '#baa3d6'],
  sage: ['#65775d', '#abbc9b', '#e1ead4', '#94aa83'],
  white: ['#a8ada9', '#eef1e9', '#ffffff', '#dce2d8'],
} as const;

export type ButterflyColor = keyof typeof BUTTERFLY_COLORS;
export const BUTTERFLY_COLOR_ORDER: ButterflyColor[] = ['pink', 'amber', 'blue', 'butter', 'purple', 'sage', 'white'];
