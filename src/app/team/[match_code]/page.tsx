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
import { NINES, formatToPar, isNineId, nextNine, parForHole, totalPar } from '@/lib/course';
import { celebrate, isSoundOn, setSoundOn, type CelebrationKind } from '@/lib/celebrate';
import { Celebration } from '@/components/Celebration';

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

  // celebration + sound
  const [party, setParty] = useState<{ kind: CelebrationKind; id: number } | null>(null);
  const [soundOn, setSound] = useState(true);
  useEffect(() => setSound(isSoundOn()), []);
  const toggleSound = () => {
    const next = !soundOn;
    setSound(next);
    setSoundOn(next);
  };
  const triggerCelebration = (kind: CelebrationKind) => {
    celebrate(kind);
    const id = Date.now();
    setParty({ kind, id });
    setTimeout(() => setParty((p) => (p?.id === id ? null : p)), 1700);
  };

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
      par: parForHole(team.start_nine, openHole), // lock in this hole's par with the score
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

    // Celebrate: finishing the round wins over the hole result; otherwise reward
    // par or better on the hole.
    const par = parForHole(team.start_nine, openHole);
    const willFinish = scores.length + 1 >= TOTAL_HOLES;
    let kind: CelebrationKind | null = null;
    if (willFinish) kind = 'finish';
    else if (par != null) {
      const d = draftStrokes - par;
      if (d <= -3) kind = 'albatross';
      else if (d === -2) kind = 'eagle';
      else if (d === -1) kind = 'birdie';
      else if (d === 0) kind = 'par';
    }

    await refresh(team.id);
    closeEntry();
    if (kind) triggerCelebration(kind);
  };

  if (loading || !ready) return <p className="p-6 text-ink-dim">Loading…</p>;

  if (!match) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Match not found</h1>
        <Link href="/" className="text-mint underline-offset-2 hover:underline">Back home</Link>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6">
        <h1 className="text-center font-display text-2xl font-bold text-ink">{match.name}</h1>
        <p className="text-center text-ink-dim">Sign in to reach your team dashboard.</p>
        <SignInButton />
      </main>
    );
  }

  if (!team) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">{match.name}</h1>
        <p className="text-ink-dim">You haven&apos;t joined this match yet.</p>
        <Link
          href={`/join/${code}`}
          className="rounded-2xl bg-mint px-5 py-4 font-display font-bold text-mint-ink shadow-glow"
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
  const startNine = isNineId(team.start_nine) ? NINES[team.start_nine] : null;
  const secondNine = isNineId(team.start_nine) ? NINES[nextNine(team.start_nine)] : null;
  const parPlayed = scores.reduce((sum, s) => sum + (parForHole(team.start_nine, s.hole_number) ?? 0), 0);
  const toPar = startNine ? gross - parPlayed : null;
  const toParTone = toPar == null ? 'text-ink' : toPar <= 0 ? 'text-mint' : 'text-coral';

  return (
    <main className="flex min-h-dvh flex-col gap-4 p-4 pb-28">
      <header className="flex items-start justify-between gap-3 pt-2">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-extrabold tracking-tight text-ink">
            {team.team_name}
          </h1>
          {team.members_label && <p className="text-sm text-ink-dim">{team.members_label}</p>}
          <p className="mt-0.5 text-xs text-ink-faint">
            {match.name} · <span className="tracking-wider">{match.match_code}</span>
          </p>
          {startNine && secondNine && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-dim">
              <span className="flex items-center">
                <span
                  className="inline-block h-3 w-3 rounded-full ring-1 ring-white/20"
                  style={{ backgroundColor: startNine.dot }}
                />
                <span
                  className="-ml-0.5 inline-block h-3 w-3 rounded-full ring-1 ring-white/20"
                  style={{ backgroundColor: secondNine.dot }}
                />
              </span>
              {startNine.label} → {secondNine.label} · par {totalPar(team.start_nine)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            onClick={toggleSound}
            aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-ink-dim transition hover:bg-white/[0.08]"
          >
            {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
          </button>
          <button
            onClick={() => signOut()}
            className="text-xs text-ink-faint underline-offset-2 hover:underline"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="glass grid grid-cols-4 gap-1 p-4 text-center">
        <Stat label="Thru" value={finished ? 'F' : String(holesPlayed)} tone={finished ? 'text-mint' : 'text-ink'} />
        <Stat label="To Par" value={formatToPar(toPar)} tone={toParTone} big />
        <Stat label="Gross" value={String(gross)} tone="text-ink" />
        <Stat label="Adj" value={String(adjusted)} tone="text-ink" />
      </div>

      <BeerButton teamId={team.id} count={beerCount} onChange={() => void refresh(team.id)} />

      <section>
        <h2 className="eyebrow mb-2.5">Scorecard</h2>
        <div className="grid grid-cols-3 gap-2">
          {HOLES.map((hole) => {
            const holePar = parForHole(team.start_nine, hole);
            const label = (
              <span className="text-[11px] text-ink-dim">
                Hole {hole}
                {holePar != null && <span className="text-ink-faint"> · par {holePar}</span>}
              </span>
            );
            const s = submittedHoles.get(hole);
            if (s) {
              const d = holePar != null ? s.strokes - holePar : null;
              const dTone = d == null ? 'text-ink-faint' : d <= 0 ? 'text-mint' : 'text-coral';
              return (
                <div
                  key={hole}
                  className="glass-2 flex flex-col items-center gap-0.5 py-3"
                >
                  {label}
                  <span className="font-display text-2xl font-bold tabular-nums text-ink">
                    {s.strokes}
                  </span>
                  {d != null && (
                    <span className={'text-[11px] font-bold ' + dTone}>{formatToPar(d)}</span>
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
                className="flex flex-col items-center gap-0.5 rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] py-3 transition hover:border-mint/40 hover:bg-white/[0.04] active:scale-95"
              >
                {label}
                <span className="font-display text-2xl font-bold text-ink-faint">+</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          Play is 1→18, but you can enter any open hole whenever. Submitted scores lock
          permanently — there is no edit.
        </p>
      </section>

      {/* Score entry sheet */}
      {openHole != null && !confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm animate-sheet-up rounded-3xl border border-white/[0.08] bg-surface p-5 shadow-glass">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-ink">
                Hole {openHole}
                {parForHole(team.start_nine, openHole) != null && (
                  <span className="ml-2 text-sm font-medium text-ink-faint">
                    par {parForHole(team.start_nine, openHole)}
                  </span>
                )}
              </h3>
              <button
                onClick={closeEntry}
                className="text-sm text-ink-dim underline-offset-2 hover:underline"
              >
                Cancel
              </button>
            </div>
            <NumberPad value={draftStrokes} onSelect={setDraftStrokes} />
            <button
              onClick={() => setConfirming(true)}
              disabled={draftStrokes == null}
              className="mt-4 w-full rounded-2xl bg-mint px-5 py-4 font-display text-lg font-bold text-mint-ink shadow-glow transition active:scale-[0.99] disabled:opacity-40 disabled:shadow-none"
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

      {error && <p className="text-center text-sm text-coral">{error}</p>}

      <Link
        href={`/match/${code}`}
        className="text-center text-sm text-mint underline-offset-2 hover:underline"
      >
        View leaderboard →
      </Link>

      {party && <Celebration key={party.id} kind={party.kind} />}
    </main>
  );
}

function SoundOnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8 8 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SoundOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      <path d="m16 9 5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Stat({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone: string;
  big?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p
        className={
          'font-display font-extrabold tabular-nums ' +
          (big ? 'text-2xl ' : 'text-xl ') +
          tone
        }
      >
        {value}
      </p>
    </div>
  );
}
