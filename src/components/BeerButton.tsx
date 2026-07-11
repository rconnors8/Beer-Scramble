'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { MAX_BEERS } from '@/lib/types';

/**
 * One-tap beer logging — the highest-frequency action. Logs immediately (so the
 * cap check and cross-device count stay correct), then shows a ~8s Undo toast.
 * Undo removes the last beer via the undo_last_beer RPC.
 */
export function BeerButton({
  teamId,
  count,
  onChange,
}: {
  teamId: string;
  count: number;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showUndo, setShowUndo] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const atCap = count >= MAX_BEERS;

  const logBeer = async () => {
    if (atCap || busy) return;
    setBusy(true);
    setError('');
    const { error } = await supabase.rpc('log_beer', { p_team_id: teamId });
    setBusy(false);
    if (error) {
      setError(error.message.includes('cap') ? 'Beer cap reached (30).' : error.message);
      return;
    }
    onChange();
    setShowUndo(true);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setShowUndo(false), 8000);
  };

  const undo = async () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setShowUndo(false);
    const { error } = await supabase.rpc('undo_last_beer', { p_team_id: teamId });
    if (!error) onChange();
  };

  return (
    <div>
      <button
        onClick={logBeer}
        disabled={atCap || busy}
        className={
          'flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-6 text-2xl font-bold shadow-sm active:scale-[0.99] ' +
          (atCap ? 'bg-slate-200 text-slate-500' : 'bg-beer-400 text-amber-950')
        }
      >
        <span>🍺</span>
        <span>{atCap ? 'Cap reached' : 'Log a Beer'}</span>
        <span className="tabular-nums">{count} / {MAX_BEERS}</span>
      </button>
      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}

      {showUndo && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex w-full max-w-md items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg">
            <span>Beer logged 🍺</span>
            <button onClick={undo} className="font-semibold text-beer-400 underline">
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
