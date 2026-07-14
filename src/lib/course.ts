// Colonie Town Golf Course — four 9-hole loops (36 holes total), transcribed
// from the scorecard. Each color is its own nine (all par 36); Pro/Men's/Ladies
// only change yardage, not par, so par is set purely by the color.
//
// An 18-hole round is a starting nine + the NEXT nine in the loop, because the
// course loops back around. The loop order is:
//
//     Green → Red → Blue → White → (back to Green)
//
// e.g. start Green → play Green then Red; start Blue → play Blue then White.

export type NineId = 'red' | 'blue' | 'white' | 'green';

export type Nine = {
  id: NineId;
  label: string;
  dot: string; // swatch color for the UI
  par: number[]; // par for the 9 holes
};

export const COURSE_NAME = 'Colonie Town Golf Course';

export const NINES: Record<NineId, Nine> = {
  red:   { id: 'red',   label: 'Red',   dot: '#e0362c', par: [5, 4, 4, 3, 5, 3, 4, 4, 4] },
  blue:  { id: 'blue',  label: 'Blue',  dot: '#3b82f6', par: [4, 5, 4, 3, 4, 4, 5, 3, 4] },
  white: { id: 'white', label: 'White', dot: '#9aa6a0', par: [4, 5, 4, 3, 5, 4, 4, 3, 4] },
  green: { id: 'green', label: 'Green', dot: '#1f9d57', par: [4, 5, 3, 4, 5, 4, 4, 3, 4] },
};

// The physical loop order. next(green)=red and next(blue)=white, per the course.
export const LOOP_ORDER: NineId[] = ['green', 'red', 'blue', 'white'];

export const START_OPTIONS: NineId[] = ['green', 'red', 'blue', 'white'];

export function isNineId(v: string | null | undefined): v is NineId {
  return v === 'red' || v === 'blue' || v === 'white' || v === 'green';
}

export function nextNine(id: NineId): NineId {
  const i = LOOP_ORDER.indexOf(id);
  return LOOP_ORDER[(i + 1) % LOOP_ORDER.length];
}

// The two nines played, in order, for a round starting on `startId`.
export function roundNines(startId: NineId): [NineId, NineId] {
  return [startId, nextNine(startId)];
}

// Which nine + local hole number (1–9) an app hole (1–18) maps to.
export function holeInfo(
  startId: string | null | undefined,
  hole: number
): { nine: Nine; local: number } | null {
  if (!isNineId(startId)) return null;
  const [a, b] = roundNines(startId);
  if (hole <= 9) return { nine: NINES[a], local: hole };
  return { nine: NINES[b], local: hole - 9 };
}

export function parForHole(startId: string | null | undefined, hole: number): number | null {
  const info = holeInfo(startId, hole);
  return info ? info.nine.par[info.local - 1] : null;
}

export function totalPar(startId: string | null | undefined): number | null {
  if (!isNineId(startId)) return null;
  const [a, b] = roundNines(startId);
  return NINES[a].par.reduce((x, y) => x + y, 0) + NINES[b].par.reduce((x, y) => x + y, 0); // 72
}

// "E" at even, "+3" over, "-2" under — standard golf to-par notation.
export function formatToPar(n: number | null): string {
  if (n === null) return '—';
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `${n}`;
}
