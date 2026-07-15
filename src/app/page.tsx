'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from '@/lib/useSession';
import { SignInButton } from '@/components/SignInButton';

export default function LandingPage() {
  const { session, loading } = useSession();
  const [code, setCode] = useState('');

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-8 p-6">
      <header className="text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-3xl shadow-glass">
          ⛳
        </div>
        <p className="eyebrow">PGCC · Colonie Town</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink">
          PGCC Beer League
        </h1>
        <p className="mt-2 text-ink-dim">
          Strokes minus beers. <span className="text-mint">Lowest wins.</span>
        </p>
      </header>

      {loading ? (
        <p className="text-center text-ink-dim">Loading…</p>
      ) : session ? (
        <div className="flex flex-col gap-4">
          <Link
            href="/create"
            className="rounded-2xl bg-mint px-5 py-4 text-center font-display text-lg font-bold text-mint-ink shadow-glow transition active:scale-[0.99]"
          >
            Create a match
          </Link>

          <div className="glass p-5">
            <label className="eyebrow">Have a match code?</label>
            <div className="mt-3 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC123"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-center font-display text-lg tracking-[0.3em] text-ink placeholder:text-ink-faint focus:border-mint/50 focus:outline-none focus:ring-2 focus:ring-mint/30"
              />
              <Link
                href={code.trim() ? `/join/${code.trim()}` : '#'}
                aria-disabled={!code.trim()}
                className={
                  'flex items-center rounded-xl px-5 font-semibold transition ' +
                  (code.trim()
                    ? 'bg-white/[0.08] text-ink hover:bg-white/[0.12]'
                    : 'pointer-events-none bg-white/[0.03] text-ink-faint')
                }
              >
                Go
              </Link>
            </div>
            {code.trim() && (
              <Link
                href={`/match/${code.trim()}`}
                className="mt-3 block text-center text-sm text-mint underline-offset-2 hover:underline"
              >
                Just view the leaderboard →
              </Link>
            )}
          </div>

          <button
            onClick={() => signOut()}
            className="text-sm text-ink-faint underline-offset-2 hover:underline"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <SignInButton />
          <p className="text-center text-sm text-ink-faint">
            Sign in to create a match or score for your team. Spectators can open any
            match link without signing in.
          </p>
        </div>
      )}
    </main>
  );
}
