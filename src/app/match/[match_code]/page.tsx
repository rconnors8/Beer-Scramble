'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { buildStanding, sortStandings, type TeamStanding } from '@/lib/scoring';
import { NINES, formatToPar, isNineId } from '@/lib/course';
import type { BeerLog, HoleScore, Match, Team } from '@/lib/types';

export default function LeaderboardPage({ params }: { params: { match_code: string } }) {
  const code = params.match_code.toUpperCase();
  const [match, setMatch] = useState<Match | null>(null);
  const [rows, setRows] = useState<TeamStanding[]>([]);
  const [ready, setReady] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const { data: m } = await supabase
      .from('matches')
      .select('*')
      .eq('match_code', code)
      .maybeSingle();
    if (!m) {
      setNotFound(true);
      setReady(true);
      return;
    }
    setMatch(m as Match);

    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .eq('match_id', m.id);
    const teamList = (teams as Team[]) ?? [];
    const teamIds = teamList.map((t) => t.id);

    let scores: HoleScore[] = [];
    let beers: BeerLog[] = [];
    if (teamIds.length > 0) {
      const [{ data: s }, { data: b }] = await Promise.all([
        supabase.from('hole_scores').select('*').in('team_id', teamIds),
        supabase.from('beer_logs').select('*').in('team_id', teamIds),
      ]);
      scores = (s as HoleScore[]) ?? [];
      beers = (b as BeerLog[]) ?? [];
    }

    const standings = teamList.map((t) =>
      buildStanding(
        t,
        scores.filter((s) => s.team_id === t.id),
        beers.filter((b) => b.team_id === t.id).length
      )
    );
    setRows(sortStandings(standings));
    setReady(true);
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: refetch the whole board on any relevant change. Small data, so a
  // full refetch is simplest; polling below is the fallback if realtime is off.
  useEffect(() => {
    const channel = supabase
      .channel(`board-${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beer_logs' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => void load())
      .subscribe();
    const poll = setInterval(() => void load(), 15000);
    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [code, load]);

  if (!ready) return <p className="p-6 text-ink-dim">Loading…</p>;

  if (notFound) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Match not found</h1>
        <Link href="/" className="text-mint underline-offset-2 hover:underline">Back home</Link>
      </main>
    );
  }

  const everyoneFinished = rows.length > 0 && rows.every((r) => r.finished);

  return (
    <main className="flex min-h-dvh flex-col gap-4 p-4">
      <header className="pt-3 text-center">
        <p className="eyebrow flex items-center justify-center gap-1.5">
          <span className={'inline-block h-1.5 w-1.5 rounded-full ' + (everyoneFinished ? 'bg-ink-faint' : 'bg-mint animate-pulse')} />
          {everyoneFinished ? 'Final results' : 'Live'} · {code}
        </p>
        <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink">
          {match?.name}
        </h1>
        {match?.course_name && <p className="text-ink-dim">{match.course_name}</p>}
      </header>

      {rows.length === 0 ? (
        <div className="glass p-8 text-center text-ink-dim">No teams have joined yet.</div>
      ) : (
        <div className="glass overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-[0.62rem] uppercase tracking-[0.08em] text-ink-faint">
                <th className="py-3 pl-3 pr-1 text-left">#</th>
                <th className="px-1.5 py-3 text-left">Team</th>
                <th className="px-1.5 py-3 text-center">Thru</th>
                <th className="px-1.5 py-3 text-center">Par</th>
                <th className="px-1.5 py-3 text-right">Gross</th>
                <th className="px-1.5 py-3 text-right">🍺</th>
                <th className="py-3 pl-1 pr-3 text-right">Adj</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const nine = isNineId(r.startNine) ? NINES[r.startNine] : null;
                const medal = ['🥇', '🥈', '🥉'][i];
                return (
                  <tr
                    key={r.teamId}
                    className={
                      'border-b border-white/[0.05] last:border-0 ' +
                      (i === 0 ? 'bg-mint/[0.04]' : '')
                    }
                  >
                    <td className="py-3 pl-3 pr-1 text-center font-display font-bold text-ink-dim">
                      {medal ?? i + 1}
                    </td>
                    <td className="px-1.5 py-3">
                      <div className="flex items-center gap-1.5">
                        {nine && (
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/20"
                            style={{ backgroundColor: nine.dot }}
                            title={`Started on ${nine.label}`}
                          />
                        )}
                        <span className="font-semibold text-ink">{r.teamName}</span>
                      </div>
                      {r.membersLabel && (
                        <div className="pl-4 text-xs text-ink-faint">{r.membersLabel}</div>
                      )}
                    </td>
                    <td className="px-1.5 py-3 text-center">
                      {r.finished ? (
                        <span className="font-display font-bold text-mint">F</span>
                      ) : (
                        <span className="tabular-nums text-ink-dim">{r.holesPlayed}</span>
                      )}
                    </td>
                    <td
                      className={
                        'px-1.5 py-3 text-center font-display font-bold tabular-nums ' +
                        (r.toPar == null
                          ? 'text-ink-faint'
                          : r.toPar <= 0
                            ? 'text-mint'
                            : 'text-coral')
                      }
                    >
                      {formatToPar(r.toPar)}
                    </td>
                    <td className="px-1.5 py-3 text-right tabular-nums text-ink-dim">
                      {r.grossStrokes}
                    </td>
                    <td className="px-1.5 py-3 text-right tabular-nums text-amber">
                      −{r.beers}
                    </td>
                    <td className="py-3 pl-1 pr-3 text-right font-display text-lg font-extrabold tabular-nums text-ink">
                      {r.adjustedScore}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-center text-xs text-ink-faint">
        <span className="text-mint">Par</span> = over/under par so far ·{' '}
        <span className="text-ink-dim">Adj</span> = gross − beers (max 30), lowest wins.
      </p>
      <Link href="/" className="text-center text-sm text-mint underline-offset-2 hover:underline">
        Home
      </Link>
    </main>
  );
}
