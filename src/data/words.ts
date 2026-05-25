export const firstWords = [
  "amber", "ash",    "birch",  "cedar",  "clover",
  "crane", "dew",    "elm",    "fern",   "finch",
  "flint", "frost",  "gale",   "hazel",  "heron",
  "jade",  "lark",   "linden", "maple",  "mint",
  "moss",  "mist",   "oak",    "pine",   "reed",
  "rowan", "sage",   "slate",  "thyme",  "wren",
] as const;

export const secondWords = [
  "bank",   "bay",    "brook",  "cove",   "dale",
  "dell",   "dune",   "fell",   "field",  "ford",
  "grove",  "haven",  "hill",   "knoll",  "lake",
  "lea",    "ledge",  "moor",   "mere",   "pond",
  "pool",   "ridge",  "rill",   "shaw",   "shore",
  "spring", "strand", "tarn",   "vale",   "weald",
] as const;

export function generateSlug(): string {
  const a = firstWords[Math.floor(Math.random() * firstWords.length)];
  const b = secondWords[Math.floor(Math.random() * secondWords.length)];
  return `${a}-${b}`;
}
