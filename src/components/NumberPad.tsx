'use client';

import { MAX_STROKES, MIN_STROKES } from '@/lib/types';

/**
 * Big thumb-friendly stroke picker (1–10). No dropdowns, no scrolling.
 */
export function NumberPad({
  value,
  onSelect,
}: {
  value: number | null;
  onSelect: (n: number) => void;
}) {
  const nums = Array.from(
    { length: MAX_STROKES - MIN_STROKES + 1 },
    (_, i) => MIN_STROKES + i
  );
  return (
    <div className="grid grid-cols-5 gap-2">
      {nums.map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            onClick={() => onSelect(n)}
            className={
              'aspect-square rounded-xl text-2xl font-bold shadow-sm active:scale-95 ' +
              (active
                ? 'bg-turf-600 text-white'
                : 'bg-white text-slate-800 border border-slate-200')
            }
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
