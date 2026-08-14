'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { SignInButton } from '@/components/SignInButton';
import { COURSE_NAME, NINES, START_OPTIONS, nextNine, type NineId } from '@/lib/course';
import type { Match } from '@/lib/types';

export default function JoinPage({ params }: { params: { match_code: string } }) {
  const code = params.match_code.toUpperCase();
  const router = useRouter();
  const { session, loading } = useSession();

  const [match, setMatch] = useState<Match | null>(null);
  const [checking, setChecking] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [membersLabel, setMembersLabel] = useState('');
  const [startNine, setStartNine] = useState<NineId>('white');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: m } = await supabase
        .from('matches')
        .select('*')
        .eq('match_code', code)
        .maybeSingle();
      if (!active) return;
      setMatch((m as Match) ?? null);

      if (m && session) {
        const { data: existing } = await supabase
          .from('teams')
          .select('id')
          .eq('match_id', m.id)
          .eq('owner_user_id', session.user.id)
          .maybeSingle();
        if (existing) {
          router.replace(`/team/${code}`);
          return;
        }
      }
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [code, session, router]);

  const join = async () => {
    if (!match || !teamName.trim() || !membersLabel.trim()) return;
    setBusy(true);
    setError('');
    const { error } = await supabase.rpc('join_team', {
      p_match_id: match.id,
      p_team_name: teamName.trim(),
      p_start_nine: startNine,
      p_members_label: membersLabel.trim(),
    });
    setBusy(false);
    if (error) {
      setError(error.message.includes('full') ? 'This match is full (8 teams max).' : error.message);
      return;
    }
    router.replace(`/team/${code}`);
  };

  if (loading || checking) return <p className="p-6 text-ink-dim">Loading…</p>;

  if (!match) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Match not found</h1>
        <p className="text-ink-dim">No match with code {code}.</p>
        <Link href="/" className="text-mint underline-offset-2 hover:underline">
          Back home
        </Link>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6">
        <div className="text-center">
          <p className="eyebrow">Join match</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">{match.name}</h1>
          {match.course_name && <p className="text-ink-dim">{match.course_name}</p>}
        </div>
        <p className="text-center text-ink-dim">Sign in with Google to score for your team.</p>
        <SignInButton />
        <Link
          href={`/match/${code}`}
          className="text-center text-sm text-mint underline-offset-2 hover:underline"
        >
          Just watch the leaderboard →
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-4 p-6">
      <div className="text-center">
        <p className="eyebrow">Set up your team</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">{match.name}</h1>
        {match.course_name && <p className="text-ink-dim">{match.course_name}</p>}
      </div>

      <label className="flex flex-col gap-2">
        <span className="eyebrow">Team name</span>
        <input
          value={teamName}
          maxLength={60}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="The Sandbaggers"
          className="input"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="eyebrow">Players</span>
        <input
          value={membersLabel}
          maxLength={60}
          onChange={(e) => setMembersLabel(e.target.value)}
          placeholder="Mike & Dave"
          className="input"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="eyebrow">Today&apos;s round</span>
        <div className="grid grid-cols-1 gap-2.5">
          {START_OPTIONS.map((id) => {
            const nine = NINES[id];
            const next = NINES[nextNine(id)];
            const active = startNine === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStartNine(id)}
                className={
                  'flex items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ' +
                  (active
                    ? 'border-mint/60 bg-mint/[0.08] ring-1 ring-mint/40'
                    : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]')
                }
              >
                <span className="flex shrink-0 items-center">
                  <span
                    className="h-5 w-5 rounded-full ring-1 ring-white/20"
                    style={{ backgroundColor: nine.dot }}
                  />
                  <span
                    className="-ml-1.5 h-5 w-5 rounded-full ring-1 ring-white/20"
                    style={{ backgroundColor: next.dot }}
                  />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-display font-bold text-ink">{nine.label}</span>
                  <span className="text-xs text-ink-dim">then {next.label}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-ink-faint">
          {COURSE_NAME} · everyone plays White then Blue today, par 72.
        </p>
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}
      <button
        onClick={join}
        disabled={busy || !teamName.trim() || !membersLabel.trim()}
        className="mt-1 rounded-2xl bg-mint px-5 py-4 font-display text-lg font-bold text-mint-ink shadow-glow transition active:scale-[0.99] disabled:opacity-40 disabled:shadow-none"
      >
        {busy ? 'Joining…' : 'Join match'}
      </button>
    </main>
  );
}
