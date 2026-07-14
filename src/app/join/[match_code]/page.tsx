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
  const [startNine, setStartNine] = useState<NineId>('green');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Look up the match, and if the signed-in user already owns a team, skip
  // straight to their dashboard.
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
    if (!match || !teamName.trim()) return;
    setBusy(true);
    setError('');
    const { error } = await supabase.rpc('join_team', {
      p_match_id: match.id,
      p_team_name: teamName.trim(),
      p_start_nine: startNine,
      p_members_label: membersLabel.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(error.message.includes('full') ? 'This match is full (8 teams max).' : error.message);
      return;
    }
    router.replace(`/team/${code}`);
  };

  if (loading || checking) return <p className="p-6 text-slate-500">Loading…</p>;

  if (!match) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold text-turf-700">Match not found</h1>
        <p className="text-slate-600">No match with code {code}.</p>
        <Link href="/" className="text-turf-600 underline">
          Back home
        </Link>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6">
        <h1 className="text-center text-2xl font-bold text-turf-700">{match.name}</h1>
        {match.course_name && <p className="text-center text-slate-600">{match.course_name}</p>}
        <p className="text-center text-slate-600">Sign in with Google to score for your team.</p>
        <SignInButton />
        <Link
          href={`/match/${code}`}
          className="text-center text-sm text-turf-600 underline"
        >
          Just watch the leaderboard →
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-4 p-6">
      <h1 className="text-center text-2xl font-bold text-turf-700">{match.name}</h1>
      {match.course_name && <p className="text-center text-slate-600">{match.course_name}</p>}
      <p className="text-center text-slate-600">Set up your team</p>

      <label className="text-sm font-medium text-slate-600">Team name</label>
      <input
        value={teamName}
        maxLength={60}
        onChange={(e) => setTeamName(e.target.value)}
        placeholder="The Sandbaggers"
        className="rounded-lg border border-slate-300 px-4 py-4 text-lg"
      />
      <label className="text-sm font-medium text-slate-600">Players (optional)</label>
      <input
        value={membersLabel}
        maxLength={60}
        onChange={(e) => setMembersLabel(e.target.value)}
        placeholder="Mike & Dave"
        className="rounded-lg border border-slate-300 px-4 py-4 text-lg"
      />

      <label className="text-sm font-medium text-slate-600">
        Starting nine — you&apos;ll play it, then the next color
      </label>
      <div className="grid grid-cols-2 gap-2">
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
                'flex items-center gap-2 rounded-xl border px-3 py-3 text-left active:scale-[0.99] ' +
                (active
                  ? 'border-turf-600 bg-turf-50 ring-2 ring-turf-500'
                  : 'border-slate-300 bg-white')
              }
            >
              <span className="flex shrink-0 items-center">
                <span
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ backgroundColor: nine.dot }}
                />
                <span
                  className="-ml-1 h-4 w-4 rounded-full border border-black/10"
                  style={{ backgroundColor: next.dot }}
                />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-semibold text-slate-800">{nine.label}</span>
                <span className="text-xs text-slate-500">then {next.label}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">
        {COURSE_NAME} · two nines, par 72. Loop: Green → Red → Blue → White → Green.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={join}
        disabled={busy || !teamName.trim()}
        className="mt-2 rounded-xl bg-turf-600 px-5 py-4 text-lg font-semibold text-white active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? 'Joining…' : 'Join match'}
      </button>
    </main>
  );
}
