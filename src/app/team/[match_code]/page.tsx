'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useSession, signOut } from '@/lib/useSession';
import { SignInButton } from '@/components/SignInButton';
import { NumberPad } from '@/components/NumberPad';
import { ConfirmModal } from '@/components/ConfirmModal';
import { BeerButton } from '@/components/BeerButton';
import {
  HOLES,
  TOTAL_HOLES,
  type BeerLog,
  type HoleScore,
  type Match,
  type Team,
} from '@/lib/types';
import { formatToPar, parForHole, teeById } from '@/lib/course';

export default function TeamPage({ params }: { params: { match_code: string } }) {
  const code = params.match_code.toUpperCase();
  const { session, loading } = useSession();

  const [match, setMatch] = useState<Match | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [scores, setScores] = useState<HoleScore[]>([]);
  const [beers, setBeers] = useState<BeerLog[]>([]);
  const [ready, setReady] = useState(false);

  // hole entry state
  const [openHole, setOpenHole] = useState<number | null>(null);
  const [draftStrokes, setDraftStrokes] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (teamId: string) => {
    const [{ data: s }, { data: b }] = await Promise.all([
      supabase.from('hole_scores').select('*').eq('team_id', teamId).order('hole_number'),
      supabase.from('beer_logs').select('*').eq('team_id', teamId),
    ]);
    setScores((s as HoleScore[]) ?? []);
    setBeers((b as BeerLog[]) ?? []);
  }, []);

  // Load match + this user's team.
  useEffect(() => {
    if (loading) return;
    let active = true;
    (async () => {
      const { data: m } = await supabase
        .from('matches')
        .select('*')
        .eq('match_code', code)
        .maybeSingle();
      if (!active) return;
      setMatch((m as Match) ?? null);
      if (!m || !session) {
        setReady(true);
        return;
      }
      const { data: t } = await supabase
        .from('teams')
        .select('*')
        .eq('match_id', m.id)
        .eq('owner_user_id', session.user.id)
        .maybeSingle();
      if (!active) return;
      setTeam((t as Team) ?? null);
      if (t) await refresh(t.id);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [code, session, loading, refresh]);

  // Realtime for this team's scores and beers.
  useEffect(() => {
    if (!team) return;
    const channel = supabase
      .channel(`team-${team.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hole_scores', filter: `team_id=eq.${team.id}` },
        () => void refresh(team.id)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beer_logs', filter: `team_id=eq.${team.id}` },
        () => void refresh(team.id)
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [team, refresh]);

  const submittedHoles = useMemo(() => {
    const map = new Map<number, HoleScore>();
    for (const s of scores) map.set(s.hole_number, s);
    return map;
  }, [scores]);

  const closeEntry = () => {
    setOpenHole(null);
    setDraftStrokes(null);
    setConfirming(false);
    setError('');
  };

  const submitScore = async () => {
    if (openHole == null || draftStrokes == null || !team) return;
    setSubmitBusy(true);
    setError('');
    const { error } = await supabase.from('hole_scores').insert({
      team_id: team.id,
      hole_number: openHole,
      strokes: draftStrokes,
      par: parForHole(team.tee, openHole), // lock in this hole's par with the score
    });
    setSubmitBusy(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes('duplicate')
          ? 'That hole is already locked.'
          : error.message
      );
      setConfirming(false);
      return;
    }
    await refresh(team.id);
    closeEntry();
  };

  if (loading || !ready) return <p className="p-6 text-slate-500">Loading…</p>;

  if (!match) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold text-turf-700">Match not found</h1>
        <Link href="/" className="text-turf-600 underline">Back home</Link>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6">
        <h1 className="text-center text-2xl font-bold text-turf-700">{match.name}</h1>
        <p className="text-center text-slate-600">Sign in to reach your team dashboard.</p>
        <SignInButton />
      </main>
    );
  }

  if (!team) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold text-turf-700">{match.name}</h1>
        <p className="text-slate-600">You haven&apos;t joined this match yet.</p>
        <Link
          href={`/join/${code}`}
          className="rounded-xl bg-turf-600 px-5 py-4 font-semibold text-white"
        >
          Set up my team
        </Link>
      </main>
    );
  }

  const holesPlayed = scores.length;
  const finished = holesPlayed >= TOTAL_HOLES;
  const gross = scores.reduce((sum, s) => sum + s.strokes, 0);
  const beerCount = beers.length;
  const adjusted = gross - beerCount;
  const tee = teeById(team.tee);
  const parPlayed = scores.reduce((sum, s) => sum + (parForHole(team.tee, s.hole_number) ?? 0), 0);
  const toPar = tee ? gross - parPlayed : null;

  return (
    <main className="flex min-h-dvh flex-col gap-4 p-4 pb-24">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-turf-700">{team.team_name}</h1>
          {team.members_label && <p className="text-sm text-slate-500">{team.members_label}</p>}
          <p className="text-sm text-slate-600">
            {match.name} · <span className="font-mono">{match.match_code}</span>
          </p>
          {tee && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span
                className="inline-block h-3 w-3 rounded-full border border-black/10"
                style={{ backgroundColor: tee.dot }}
              />
              {tee.label} tees · par {tee.ninePar.reduce((a, b) => a + b, 0) * 2}
            </p>
          )}
        </div>
        <button onClick={() => signOut()} className="text-xs text-slate-400 underline">
          Sign out
        </button>
      </header>

      <div className="grid grid-cols-4 gap-2 rounded-2xl bg-white p-3 text-center shadow-sm">
        <Stat label="Status" value={finished ? 'F' : `Thru ${holesPlayed}`} />
        <Stat label="To Par" value={formatToPar(toPar)} highlight />
        <Stat label="Gross" value={String(gross)} />
        <Stat label="Adj" value={String(adjusted)} />
      </div>

      <BeerButton teamId={team.id} count={beerCount} onChange={() => void refresh(team.id)} />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Scorecard
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {HOLES.map((hole) => {
            const holePar = parForHole(team.tee, hole);
            const s = submittedHoles.get(hole);
            if (s) {
              const d = holePar != null ? s.strokes - holePar : null;
              return (
                <div
                  key={hole}
                  className="flex flex-col items-center rounded-xl border border-turf-100 bg-turf-50 py-3"
                >
                  <span className="text-xs text-slate-500">
                    Hole {hole}{holePar != null && <span className="text-slate-400"> · par {holePar}</span>}
                  </span>
                  <span className="text-2xl font-bold text-turf-700">{s.strokes}</span>
                  {d != null && (
                    <span className="text-[11px] font-semibold text-slate-400">{formatToPar(d)}</span>
                  )}
                </div>
              );
            }
            return (
              <button
                key={hole}
                onClick={() => {
                  setOpenHole(hole);
                  setDraftStrokes(null);
                }}
                className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white py-3 active:scale-95"
              >
                <span className="text-xs text-slate-500">
                  Hole {hole}{holePar != null && <span className="text-slate-400"> · par {holePar}</span>}
                </span>
                <span className="text-2xl font-bold text-slate-300">–</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Play is 1→18, but you can enter any open hole whenever. Submitted scores lock
          permanently — there is no edit.
        </p>
      </section>

      {/* Score entry sheet */}
      {openHole != null && !confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                Hole {openHole}
                {parForHole(team.tee, openHole) != null && (
                  <span className="ml-2 text-sm font-medium text-slate-400">
                    par {parForHole(team.tee, openHole)}
                  </span>
                )}
              </h3>
              <button onClick={closeEntry} className="text-sm text-slate-500 underline">
                Cancel
              </button>
            </div>
            <NumberPad value={draftStrokes} onSelect={setDraftStrokes} />
            <button
              onClick={() => setConfirming(true)}
              disabled={draftStrokes == null}
              className="mt-4 w-full rounded-xl bg-turf-600 px-5 py-4 text-lg font-semibold text-white active:scale-[0.99] disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {/* Confirmation */}
      {openHole != null && confirming && draftStrokes != null && (
        <ConfirmModal
          message={`Hole ${openHole}: score of ${draftStrokes} — Confirm?`}
          onConfirm={submitScore}
          onCancel={() => setConfirming(false)}
          busy={submitBusy}
        />
      )}

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <Link href={`/match/${code}`} className="text-center text-sm text-turf-600 underline">
        View leaderboard →
      </Link>
    </main>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={'text-xl font-extrabold ' + (highlight ? 'text-turf-700' : 'text-slate-800')}>
        {value}
      </p>
    </div>
  );
}
