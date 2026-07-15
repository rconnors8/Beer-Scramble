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
    <div className="grid grid-cols-5 gap-2.5">
      {nums.map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            onClick={() => onSelect(n)}
            className={
              'aspect-square rounded-2xl font-display text-2xl font-bold tabular-nums transition active:scale-95 ' +
              (active
                ? 'bg-mint text-mint-ink shadow-glow'
                : 'border border-white/[0.08] bg-white/[0.04] text-ink hover:bg-white/[0.08]')
            }
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
