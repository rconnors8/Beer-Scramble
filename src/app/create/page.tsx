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

  if (loading) return <p className="p-6 text-ink-dim">Loading…</p>;
  if (!session) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6">
        <h1 className="text-center font-display text-2xl font-bold text-ink">Create a match</h1>
        <p className="text-center text-ink-dim">Sign in first to create a match.</p>
        <SignInButton />
      </main>
    );
  }

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError('');
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
        <div className="glass px-6 py-7 text-center">
          <p className="eyebrow">Match created</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">{created.name}</h1>
          {created.course_name && <p className="text-ink-dim">{created.course_name}</p>}
          <p className="mt-4 text-xs uppercase tracking-widest text-ink-faint">Match code</p>
          <p className="font-display text-5xl font-extrabold tracking-[0.15em] text-mint">
            {created.match_code}
          </p>
        </div>

        <ShareLink label="Team join link" href={`${origin}/join/${created.match_code}`} />
        <ShareLink label="Leaderboard link" href={`${origin}/match/${created.match_code}`} />

        <div className="mt-2 flex flex-col gap-3">
          <Link
            href={`/join/${created.match_code}`}
            className="rounded-2xl bg-mint px-5 py-4 text-center font-display font-bold text-mint-ink shadow-glow transition active:scale-[0.99]"
          >
            Set up my team
          </Link>
          <Link
            href={`/match/${created.match_code}`}
            className="text-center text-sm text-mint underline-offset-2 hover:underline"
          >
            Open leaderboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-4 p-6">
      <Link href="/" className="text-sm text-ink-faint underline-offset-2 hover:underline">
        ← Home
      </Link>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
        Create a match
      </h1>
      <Field label="Match name">
        <input
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="Saturday Scramble"
          className="input"
        />
      </Field>
      <Field label="Course (optional)">
        <input
          value={course}
          maxLength={80}
          onChange={(e) => setCourse(e.target.value)}
          placeholder="Colonie Town"
          className="input"
        />
      </Field>
      {error && <p className="text-sm text-coral">{error}</p>}
      <button
        onClick={create}
        disabled={busy || !name.trim()}
        className="mt-2 rounded-2xl bg-mint px-5 py-4 font-display text-lg font-bold text-mint-ink shadow-glow transition active:scale-[0.99] disabled:opacity-40 disabled:shadow-none"
      >
        {busy ? 'Creating…' : 'Create match'}
      </button>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
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
    <div className="glass-2 flex items-center gap-2 p-3">
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{label}</p>
        <p className="mt-0.5 truncate text-sm text-ink-dim">{href}</p>
      </div>
      <button
        onClick={copy}
        className="shrink-0 rounded-xl border border-mint/30 bg-mint/10 px-3 py-2 text-sm font-semibold text-mint transition active:scale-95"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
