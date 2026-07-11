import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  HOLES,
  MAX_BEERS,
  MAX_STROKES,
  MIN_STROKES,
  type Match as MatchT,
  type Score,
  type Team,
} from '../lib/types';

type Props = { matchId: string; userId: string };

export default function Match({ matchId, userId }: Props) {
  const [match, setMatch] = useState<MatchT | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(() =>
    localStorage.getItem(`bs.team.${matchId}`)
  );

  const loadAll = useCallback(async () => {
    const [{ data: mData }, { data: tData }, { data: sData }] = await Promise.all([
      supabase.from('matches').select('*').eq('id', matchId).maybeSingle(),
      supabase.from('teams').select('*').eq('match_id', matchId).order('created_at'),
      supabase.from('scores').select('*').eq('match_id', matchId),
    ]);
    if (!mData) {
      setNotFound(true);
    } else {
      setMatch(mData);
    }
    setTeams(tData ?? []);
    setScores(sData ?? []);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Live updates across every phone in the group.
  useEffect(() => {
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores', filter: `match_id=eq.${matchId}` },
        () => void loadAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `match_id=eq.${matchId}` },
        () => void loadAll()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, loadAll]);

  const selectTeam = (id: string) => {
    localStorage.setItem(`bs.team.${matchId}`, id);
    setTeamId(id);
  };
  const leaveTeam = () => {
    localStorage.removeItem(`bs.team.${matchId}`);
    setTeamId(null);
  };

  const myTeam = teams.find((t) => t.id === teamId) ?? null;

  if (loading) return <div className="center muted">Loading match…</div>;
  if (notFound) {
    return (
      <div className="card">
        <p>Match not found.</p>
        <a className="btn btn-ghost" href="#/">Back home</a>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="card match-head">
        <div>
          <h2>{match?.name}</h2>
          <p className="muted">
            Share code <span className="mono chip">{match?.join_code}</span>
          </p>
        </div>
      </section>

      {myTeam ? (
        <Scorecard
          team={myTeam}
          scores={scores.filter((s) => s.team_id === myTeam.id)}
          matchId={matchId}
          userId={userId}
          onChange={loadAll}
          onLeave={leaveTeam}
        />
      ) : (
        <TeamPicker
          teams={teams}
          matchId={matchId}
          userId={userId}
          onSelect={selectTeam}
          onChange={loadAll}
        />
      )}

      <Leaderboard teams={teams} scores={scores} myTeamId={myTeam?.id ?? null} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function TeamPicker({
  teams,
  matchId,
  userId,
  onSelect,
  onChange,
}: {
  teams: Team[];
  matchId: string;
  userId: string;
  onSelect: (id: string) => void;
  onChange: () => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const createTeam = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    const { data, error } = await supabase
      .from('teams')
      .insert({ match_id: matchId, name: trimmed, created_by: userId })
      .select()
      .single();
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    await onChange();
    onSelect(data.id);
  };

  return (
    <section className="card">
      <h2>Play as…</h2>
      {teams.length > 0 && (
        <ul className="list">
          {teams.map((t) => (
            <li key={t.id}>
              <button className="list-item as-button" onClick={() => onSelect(t.id)}>
                <span className="list-item-title">{t.name}</span>
                <span className="muted">🍺 {t.beer_count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <input
          className="input"
          placeholder="New team name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createTeam()}
        />
        <button className="btn" disabled={busy || !name.trim()} onClick={createTeam}>
          Add team
        </button>
      </div>
      <p className="fine-print muted">Team names don't have to be unique.</p>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------

function Scorecard({
  team,
  scores,
  matchId,
  userId,
  onChange,
  onLeave,
}: {
  team: Team;
  scores: Score[];
  matchId: string;
  userId: string;
  onChange: () => void | Promise<void>;
  onLeave: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busyHole, setBusyHole] = useState<number | null>(null);
  const [beerBusy, setBeerBusy] = useState(false);
  const [error, setError] = useState('');

  const byHole = useMemo(() => {
    const map = new Map<number, Score>();
    for (const s of scores) map.set(s.hole, s);
    return map;
  }, [scores]);

  // Sequential 1→18: the "current" hole is the lowest one not yet submitted.
  const currentHole = HOLES.find((h) => !byHole.has(h)) ?? null;
  const finished = byHole.has(18);

  const submit = async (hole: number) => {
    const raw = drafts[hole];
    const strokes = Number(raw);
    if (!raw || !Number.isInteger(strokes) || strokes < MIN_STROKES || strokes > MAX_STROKES) {
      setError(`Enter a score between ${MIN_STROKES} and ${MAX_STROKES}.`);
      return;
    }
    // The one and only safeguard before a score locks forever.
    if (!window.confirm(`Hole ${hole}: score of ${strokes} — Confirm?`)) return;

    setBusyHole(hole);
    setError('');
    const { error } = await supabase
      .from('scores')
      .insert({ match_id: matchId, team_id: team.id, hole, strokes, created_by: userId });
    setBusyHole(null);
    if (error) {
      setError(error.message);
      return;
    }
    setDrafts((d) => {
      const next = { ...d };
      delete next[hole];
      return next;
    });
    await onChange();
  };

  const addBeer = async () => {
    if (team.beer_count >= MAX_BEERS) return;
    setBeerBusy(true);
    setError('');
    const { error } = await supabase
      .from('teams')
      .update({ beer_count: team.beer_count + 1 })
      .eq('id', team.id);
    setBeerBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    await onChange();
  };

  const total = scores.reduce((sum, s) => sum + s.strokes, 0);

  return (
    <section className="card">
      <div className="scorecard-head">
        <div>
          <h2>{team.name}</h2>
          <p className="muted">
            {finished ? 'Finished' : currentHole ? `On hole ${currentHole}` : 'Round complete'} ·
            {' '}Total {total}
          </p>
        </div>
        <button className="link" onClick={onLeave}>Switch team</button>
      </div>

      <div className="beer-bar">
        <span className="beer-count">🍺 {team.beer_count} / {MAX_BEERS}</span>
        <button
          className="btn btn-beer"
          disabled={beerBusy || team.beer_count >= MAX_BEERS}
          onClick={addBeer}
        >
          {team.beer_count >= MAX_BEERS ? 'Cap reached' : '+1 beer'}
        </button>
      </div>

      <div className="holes">
        {HOLES.map((hole) => {
          const existing = byHole.get(hole);
          const isCurrent = hole === currentHole;
          if (existing) {
            return (
              <div key={hole} className="hole locked">
                <span className="hole-num">{hole}</span>
                <span className="hole-score">{existing.strokes}</span>
              </div>
            );
          }
          return (
            <div key={hole} className={`hole${isCurrent ? ' current' : ''}`}>
              <span className="hole-num">{hole}</span>
              <input
                className="hole-input"
                type="number"
                inputMode="numeric"
                min={MIN_STROKES}
                max={MAX_STROKES}
                placeholder="–"
                value={drafts[hole] ?? ''}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [hole]: e.target.value }))
                }
              />
              <button
                className="btn btn-small"
                disabled={busyHole === hole || !drafts[hole]}
                onClick={() => submit(hole)}
              >
                {busyHole === hole ? '…' : 'Submit'}
              </button>
            </div>
          );
        })}
      </div>

      <p className="fine-print muted">
        Submitted scores are final — there's no edit. Confirm carefully.
      </p>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------

function Leaderboard({
  teams,
  scores,
  myTeamId,
}: {
  teams: Team[];
  scores: Score[];
  myTeamId: string | null;
}) {
  const rows = useMemo(() => {
    return teams
      .map((t) => {
        const ts = scores.filter((s) => s.team_id === t.id);
        const total = ts.reduce((sum, s) => sum + s.strokes, 0);
        const holesPlayed = ts.length;
        const finished = ts.some((s) => s.hole === 18);
        return { team: t, total, holesPlayed, finished };
      })
      .sort((a, b) => {
        // Teams that haven't teed off sink to the bottom; otherwise lowest
        // total wins, breaking ties by who's played more holes.
        if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
        if (a.holesPlayed === 0) return 1;
        if (b.holesPlayed === 0) return -1;
        return a.total - b.total || b.holesPlayed - a.holesPlayed;
      });
  }, [teams, scores]);

  return (
    <section className="card">
      <h2>Leaderboard</h2>
      {rows.length === 0 ? (
        <p className="muted">No teams yet.</p>
      ) : (
        <table className="board">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th className="num">Thru</th>
              <th className="num">Total</th>
              <th className="num">🍺</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.team.id} className={r.team.id === myTeamId ? 'mine' : ''}>
                <td>{i + 1}</td>
                <td>{r.team.name}</td>
                <td className="num">
                  {r.finished ? <strong>F</strong> : r.holesPlayed}
                </td>
                <td className="num">{r.total}</td>
                <td className="num">{r.team.beer_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
