'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { SignInButton } from '@/components/SignInButton';
import type { Match } from '@/lib/types';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I

function randomCode(len = 6): string {
  let out = '';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return out;
}

export default function CreatePage() {
  const { session, loading } = useSession();
  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Match | null>(null);

  if (loading) return <p className="p-6 text-slate-500">Loading…</p>;
  if (!session) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6">
        <h1 className="text-center text-2xl font-bold text-turf-700">Create a match</h1>
        <p className="text-center text-slate-600">Sign in first to create a match.</p>
        <SignInButton />
      </main>
    );
  }

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    // Retry a couple of times in the (unlikely) event of a code collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const match_code = randomCode();
      const { data, error } = await supabase
        .from('matches')
        .insert({
          name: name.trim(),
          course_name: course.trim() || null,
          match_code,
          owner_user_id: session.user.id,
        })
        .select()
        .single();
      if (!error && data) {
        setCreated(data as Match);
        setBusy(false);
        return;
      }
      if (error && !error.message.toLowerCase().includes('duplicate')) {
        setError(error.message);
        setBusy(false);
        return;
      }
    }
    setError('Could not generate a unique code — try again.');
    setBusy(false);
  };

  if (created) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-5 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-turf-700">{created.name}</h1>
          {created.course_name && <p className="text-slate-600">{created.course_name}</p>}
          <p className="mt-3 text-sm text-slate-500">Match code</p>
          <p className="font-mono text-4xl font-extrabold tracking-widest text-slate-800">
            {created.match_code}
          </p>
        </div>

        <ShareLink label="Team join link" href={`${origin}/join/${created.match_code}`} />
        <ShareLink label="Leaderboard link" href={`${origin}/match/${created.match_code}`} />

        <div className="mt-2 flex flex-col gap-2">
          <Link
            href={`/join/${created.match_code}`}
            className="rounded-xl bg-turf-600 px-5 py-4 text-center font-semibold text-white active:scale-[0.99]"
          >
            Set up my team
          </Link>
          <Link
            href={`/match/${created.match_code}`}
            className="text-center text-sm text-turf-600 underline"
          >
            Open leaderboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-4 p-6">
      <Link href="/" className="text-sm text-slate-500 underline">
        ← Home
      </Link>
      <h1 className="text-2xl font-bold text-turf-700">Create a match</h1>
      <label className="text-sm font-medium text-slate-600">Match name</label>
      <input
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        placeholder="Saturday Scramble"
        className="rounded-lg border border-slate-300 px-4 py-4 text-lg"
      />
      <label className="text-sm font-medium text-slate-600">Course (optional)</label>
      <input
        value={course}
        maxLength={80}
        onChange={(e) => setCourse(e.target.value)}
        placeholder="Pine Valley"
        className="rounded-lg border border-slate-300 px-4 py-4 text-lg"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={create}
        disabled={busy || !name.trim()}
        className="mt-2 rounded-xl bg-turf-600 px-5 py-4 text-lg font-semibold text-white active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create match'}
      </button>
    </main>
  );
}

function ShareLink({ label, href }: { label: string; href: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; the text is visible to copy manually */
    }
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{href}</span>
        <button
          onClick={copy}
          className="shrink-0 rounded-lg bg-turf-100 px-3 py-2 text-sm font-semibold text-turf-700"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
