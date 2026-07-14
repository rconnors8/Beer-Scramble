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

  if (!ready) return <p className="p-6 text-slate-500">Loading…</p>;

  if (notFound) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold text-turf-700">Match not found</h1>
        <Link href="/" className="text-turf-600 underline">Back home</Link>
      </main>
    );
  }

  const everyoneFinished = rows.length > 0 && rows.every((r) => r.finished);

  return (
    <main className="flex min-h-dvh flex-col gap-4 p-4">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-turf-700">{match?.name}</h1>
        {match?.course_name && <p className="text-slate-600">{match.course_name}</p>}
        <p className="mt-1 text-sm text-slate-500">
          {everyoneFinished ? 'Final results' : 'Live leaderboard'} ·{' '}
          <span className="font-mono">{code}</span>
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-center text-slate-500">No teams have joined yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-2 py-3 text-left">#</th>
                <th className="px-1.5 py-3 text-left">Team</th>
                <th className="px-1.5 py-3 text-center">Thru</th>
                <th className="px-1.5 py-3 text-center">Par</th>
                <th className="px-1.5 py-3 text-right">Gross</th>
                <th className="px-1.5 py-3 text-right">🍺</th>
                <th className="px-2 py-3 text-right">Adj</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const nine = isNineId(r.startNine) ? NINES[r.startNine] : null;
                return (
                  <tr key={r.teamId} className="border-b border-slate-50 last:border-0">
                    <td className="px-2 py-3 font-semibold text-slate-400">{i + 1}</td>
                    <td className="px-1.5 py-3">
                      <div className="flex items-center gap-1.5">
                        {nine && (
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                            style={{ backgroundColor: nine.dot }}
                            title={`Started on ${nine.label}`}
                          />
                        )}
                        <span className="font-semibold text-slate-800">{r.teamName}</span>
                      </div>
                      {r.membersLabel && (
                        <div className="pl-4 text-xs text-slate-400">{r.membersLabel}</div>
                      )}
                    </td>
                    <td className="px-1.5 py-3 text-center">
                      {r.finished ? (
                        <span className="font-bold text-turf-700">F</span>
                      ) : (
                        <span className="text-slate-500">{r.holesPlayed}</span>
                      )}
                    </td>
                    <td
                      className={
                        'px-1.5 py-3 text-center font-bold tabular-nums ' +
                        (r.toPar == null
                          ? 'text-slate-300'
                          : r.toPar <= 0
                            ? 'text-turf-600'
                            : 'text-slate-600')
                      }
                    >
                      {formatToPar(r.toPar)}
                    </td>
                    <td className="px-1.5 py-3 text-right tabular-nums text-slate-600">
                      {r.grossStrokes}
                    </td>
                    <td className="px-1.5 py-3 text-right tabular-nums text-beer-500">
                      −{r.beers}
                    </td>
                    <td className="px-2 py-3 text-right text-lg font-extrabold tabular-nums text-turf-700">
                      {r.adjustedScore}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-center text-xs text-slate-400">
        Par = over/under par so far · Adjusted = gross − beers (max 30), lowest wins.
      </p>
      <Link href="/" className="text-center text-sm text-turf-600 underline">
        Home
      </Link>
    </main>
  );
}
