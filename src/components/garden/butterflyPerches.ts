export type PerchPoint = { x: number; y: number };
export type PerchCandidate = PerchPoint & { key: string };

// Keep landing footholds distinct at the requested density.
export function spacedPerches<T extends PerchCandidate>(candidates: T[], spacing: number): T[] {
  const selected: T[] = [];
  for (const candidate of candidates) {
    if (selected.every(other => Math.hypot(candidate.x - other.x, candidate.y - other.y) >= spacing)) {
      selected.push(candidate);
    }
  }
  return selected;
}

export function availablePerch<T extends PerchCandidate>(spots: T[], occupied: Set<string>): T | undefined {
  const free = spots.filter(spot => !occupied.has(spot.key));
  const taken = spots.filter(spot => occupied.has(spot.key));
  // Fill the largest gaps first instead of clustering at one end of the text.
  return free.sort((a, b) => {
    const distance = (spot: T) => taken.length
      ? Math.min(...taken.map(other => Math.hypot(spot.x - other.x, spot.y - other.y))) : 0;
    return distance(b) - distance(a);
  })[0];
}
