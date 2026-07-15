'use client';

import type { CelebrationKind } from '@/lib/celebrate';

const CONFIG: Record<CelebrationKind, { label: string; sub: string; tone: string }> = {
  par: { label: 'PAR', sub: 'right on the number', tone: 'text-mint' },
  birdie: { label: 'BIRDIE', sub: 'one under', tone: 'text-mint' },
  eagle: { label: 'EAGLE', sub: 'two under — dialed', tone: 'text-amber' },
  albatross: { label: 'ALBATROSS', sub: 'absurd', tone: 'text-amber' },
  finish: { label: 'FINISHED', sub: 'round complete', tone: 'text-mint' },
};

export function Celebration({ kind }: { kind: CelebrationKind }) {
  const c = CONFIG[kind];
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center">
      <div className="animate-celebrate text-center">
        <div
          className={
            'font-display text-6xl font-extrabold tracking-tight [text-shadow:0_4px_30px_rgba(0,0,0,0.5)] ' +
            c.tone
          }
        >
          {c.label}
        </div>
        <div className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-ink-dim">
          {c.sub}
        </div>
      </div>
    </div>
  );
}
