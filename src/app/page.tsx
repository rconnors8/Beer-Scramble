'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from '@/lib/useSession';
import { SignInButton } from '@/components/SignInButton';

export default function LandingPage() {
  const { session, loading } = useSession();
  const [code, setCode] = useState('');

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <div className="text-5xl">⛳🍺</div>
        <h1 className="mt-2 text-3xl font-extrabold text-turf-700">Golf Beer League</h1>
        <p className="mt-1 text-slate-600">Strokes minus beers. Lowest wins.</p>
      </header>

      {loading ? (
        <p className="text-center text-slate-500">Loading…</p>
      ) : session ? (
        <div className="flex flex-col gap-3">
          <Link
            href="/create"
            className="rounded-xl bg-turf-600 px-5 py-4 text-center text-lg font-semibold text-white shadow-sm active:scale-[0.99]"
          >
            Create a match
          </Link>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label className="text-sm font-medium text-slate-600">Have a match code?</label>
            <div className="mt-2 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC123"
                className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-lg font-mono tracking-widest"
              />
              <Link
                href={code.trim() ? `/join/${code.trim()}` : '#'}
                aria-disabled={!code.trim()}
                className={
                  'rounded-lg px-4 py-3 text-base font-semibold text-white ' +
                  (code.trim() ? 'bg-turf-600' : 'pointer-events-none bg-slate-300')
                }
              >
                Go
              </Link>
            </div>
            {code.trim() && (
              <Link
                href={`/match/${code.trim()}`}
                className="mt-2 block text-center text-sm text-turf-600 underline"
              >
                Just view the leaderboard →
              </Link>
            )}
          </div>

          <button onClick={() => signOut()} className="text-sm text-slate-500 underline">
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <SignInButton />
          <p className="text-center text-sm text-slate-500">
            Sign in to create a match or score for your team. Spectators can open any
            match link without signing in.
          </p>
        </div>
      )}
    </main>
  );
}
