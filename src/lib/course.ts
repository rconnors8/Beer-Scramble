// Course + tee data, transcribed from the Colonie Town Golf Course scorecard.
//
// It's a 9-hole course. Each colored "course" is a 9-hole layout (all par 36);
// the Pro/Men's/Ladies' rows only change yardage, not par, so par is set purely
// by the color chosen. For an 18-hole round we repeat the nine (front + back),
// giving par 72.

export type TeeId = 'red' | 'blue' | 'white' | 'green';

export type Tee = {
  id: TeeId;
  label: string;
  dot: string;      // swatch color for the UI
  ninePar: number[]; // par for holes 1..9
};

export const COURSE_NAME = 'Colonie Town Golf Course';

export const TEES: Tee[] = [
  { id: 'red',   label: 'Red',   dot: '#e0362c', ninePar: [5, 4, 4, 3, 5, 3, 4, 4, 4] },
  { id: 'blue',  label: 'Blue',  dot: '#3b82f6', ninePar: [4, 5, 4, 3, 4, 4, 5, 3, 4] },
  { id: 'white', label: 'White', dot: '#9aa6a0', ninePar: [4, 5, 4, 3, 5, 4, 4, 3, 4] },
  { id: 'green', label: 'Green', dot: '#1f9d57', ninePar: [4, 5, 3, 4, 5, 4, 4, 3, 4] },
];

export function teeById(id: string | null | undefined): Tee | null {
  return TEES.find((t) => t.id === id) ?? null;
}

// Holes 1–9 and 10–18 map onto the same nine.
export function parForHole(teeId: string | null | undefined, hole: number): number | null {
  const tee = teeById(teeId);
  if (!tee) return null;
  return tee.ninePar[(hole - 1) % 9];
}

export function totalPar(teeId: string | null | undefined): number | null {
  const tee = teeById(teeId);
  if (!tee) return null;
  return tee.ninePar.reduce((a, b) => a + b, 0) * 2; // 72
}

// "E" at even, "+3" over, "-2" under — standard golf to-par notation.
export function formatToPar(n: number | null): string {
  if (n === null) return '—';
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `${n}`;
}
