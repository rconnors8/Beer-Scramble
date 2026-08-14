'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { playClink } from '@/lib/celebrate';
import { ConfirmModal } from '@/components/ConfirmModal';

/**
 * Beer logging — an unlimited running tally. A confirm step guards each log,
 * then it writes immediately (so the cross-device count stays correct) and shows
 * a ~8s Undo toast. Undo removes the last beer via the undo_last_beer RPC.
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
  const [confirming, setConfirming] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const logBeer = async () => {
    if (busy) return;
    setConfirming(false);
    setBusy(true);
    setError('');
    const { error } = await supabase.rpc('log_beer', { p_team_id: teamId });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    playClink();
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
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="w-full rounded-3xl bg-amber px-5 py-5 text-left text-amber-ink shadow-glow-amber transition active:scale-[0.99] disabled:opacity-70"
      >
        <div className="flex items-center justify-between">
          <span className="font-display text-xl font-extrabold tracking-tight">
            LOG A BEER BUD
          </span>
          <span className="font-display text-3xl font-extrabold tabular-nums text-amber-ink">
            {count}
          </span>
        </div>
      </button>
      {error && <p className="mt-2 text-center text-sm text-coral">{error}</p>}

      {confirming && (
        <ConfirmModal
          message="Log a beer for the team? 🍺"
          confirmLabel="Log it"
          onConfirm={logBeer}
          onCancel={() => setConfirming(false)}
          busy={busy}
        />
      )}

      {showUndo && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="flex w-full max-w-md animate-sheet-up items-center justify-between rounded-2xl border border-white/[0.08] bg-surface-2/95 px-4 py-3 text-ink shadow-glass backdrop-blur-xl">
            <span className="font-medium">Beer logged</span>
            <button onClick={undo} className="font-bold text-amber underline-offset-2 hover:underline">
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
