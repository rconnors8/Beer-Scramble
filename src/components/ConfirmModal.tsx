'use client';

/**
 * The single safeguard before a score locks forever. One line, two buttons —
 * deliberately not a multi-step flow.
 */
export function ConfirmModal({
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  busy,
}: {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm animate-pop-in rounded-3xl border border-white/[0.08] bg-surface p-6 shadow-glass">
        <p className="text-center text-lg font-semibold text-ink">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 py-4 text-base font-semibold text-ink-dim transition active:scale-[0.99] disabled:opacity-50"
          >
            Go back
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-2xl bg-mint px-4 py-4 text-base font-bold text-mint-ink shadow-glow transition active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
