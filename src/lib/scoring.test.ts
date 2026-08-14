import { describe, expect, it } from 'vitest';
import { buildStanding, sortStandings, type TeamStanding } from './scoring';
import type { HoleScore } from './types';

let idCounter = 0;

/** Build `count` hole scores (holes 1..count) each with the given strokes. */
function scores(teamId: string, count: number, strokesEach = 4): HoleScore[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `score-${idCounter++}`,
    team_id: teamId,
    hole_number: i + 1,
    strokes: strokesEach,
    par: 4,
    submitted_at: new Date().toISOString(),
  }));
}

const team = (id: string, name = id, start_nine: string | null = null) => ({
  id,
  team_name: name,
  members_label: null,
  start_nine,
});

describe('buildStanding', () => {
  it('sums gross strokes and computes adjusted = gross - beers', () => {
    const s = buildStanding(team('a'), scores('a', 9, 5), 4);
    expect(s.grossStrokes).toBe(45);
    expect(s.beers).toBe(4);
    expect(s.adjustedScore).toBe(41);
  });

  it('reports "Thru N" mid-round', () => {
    const s = buildStanding(team('a'), scores('a', 12), 0);
    expect(s.finished).toBe(false);
    expect(s.holesPlayed).toBe(12);
    expect(s.status).toBe('Thru 12');
  });

  it('reports "F" once all 18 holes are in', () => {
    const s = buildStanding(team('a'), scores('a', 18), 10);
    expect(s.finished).toBe(true);
    expect(s.status).toBe('F');
  });

  it('counts beers with no cap (unlimited)', () => {
    const s = buildStanding(team('a'), scores('a', 18, 4), 45);
    // gross = 72, all 45 beers count -> adjusted 27
    expect(s.beers).toBe(45);
    expect(s.adjustedScore).toBe(27);
  });

  it('handles a team that has not teed off', () => {
    const s = buildStanding(team('a'), [], 0);
    expect(s.holesPlayed).toBe(0);
    expect(s.grossStrokes).toBe(0);
    expect(s.adjustedScore).toBe(0);
    expect(s.status).toBe('Thru 0');
  });

  it('can produce a negative adjusted score when beers exceed strokes', () => {
    const s = buildStanding(team('a'), scores('a', 5, 1), 12);
    // gross = 5, beers = 12 -> adjusted -7
    expect(s.adjustedScore).toBe(-7);
  });

  it('leaves toPar null when no starting nine is chosen', () => {
    const s = buildStanding(team('a'), scores('a', 9, 4), 0);
    expect(s.startNine).toBeNull();
    expect(s.toPar).toBeNull();
  });

  it('computes toPar over the starting nine (par 36) at even', () => {
    // Green front nine par = [4,5,3,4,5,4,4,3,4] = 36. Play 9 at 4 each = 36.
    const s = buildStanding(team('a', 'a', 'green'), scores('a', 9, 4), 0);
    expect(s.grossStrokes).toBe(36);
    expect(s.toPar).toBe(0);
  });

  it('spans both nines: start Green then Red for 18 holes', () => {
    // Green nine par 36 + Red nine par 36 = 72. Play all 18 at par-even is hard to
    // fake with flat strokes, so check the par total via a level round: 4 each.
    const s = buildStanding(team('a', 'a', 'green'), scores('a', 18, 4), 0);
    expect(s.grossStrokes).toBe(72);
    // par over 18 = 72, so toPar = 72 - 72 = 0.
    expect(s.toPar).toBe(0);
  });

  it('reports over par correctly on a partial round', () => {
    // Green holes 1–3 par 4,5,3 = 12. Strokes 6,5,5 = 16 -> +4.
    const three: HoleScore[] = [
      { id: 'x1', team_id: 'a', hole_number: 1, strokes: 6, par: 4, submitted_at: '' },
      { id: 'x2', team_id: 'a', hole_number: 2, strokes: 5, par: 5, submitted_at: '' },
      { id: 'x3', team_id: 'a', hole_number: 3, strokes: 5, par: 3, submitted_at: '' },
    ];
    const s = buildStanding(team('a', 'a', 'green'), three, 0);
    expect(s.toPar).toBe(4);
  });
});

describe('sortStandings', () => {
  const standing = (over: Partial<TeamStanding> & { teamId: string }): TeamStanding => ({
    teamName: over.teamId,
    membersLabel: null,
    startNine: null,
    holesPlayed: 18,
    finished: true,
    status: 'F',
    grossStrokes: 0,
    toPar: null,
    beers: 0,
    adjustedScore: 0,
    ...over,
  });

  it('orders by score to par ascending — E beats +1, ignoring hole count', () => {
    const rows = sortStandings([
      standing({ teamId: 'plus3', holesPlayed: 18, toPar: 3 }),
      // even par but only 4 holes in — still ranks ahead of the +1 and +3 teams
      standing({ teamId: 'even', holesPlayed: 4, toPar: 0 }),
      standing({ teamId: 'plus1', holesPlayed: 18, toPar: 1 }),
    ]);
    expect(rows.map((r) => r.teamId)).toEqual(['even', 'plus1', 'plus3']);
  });

  it('sinks teams that have not teed off to the bottom', () => {
    const rows = sortStandings([
      standing({ teamId: 'notStarted', holesPlayed: 0, finished: false, toPar: 0 }),
      standing({ teamId: 'playing', holesPlayed: 3, finished: false, toPar: 5 }),
    ]);
    expect(rows.map((r) => r.teamId)).toEqual(['playing', 'notStarted']);
  });

  it('breaks ties (same to par) toward the team that has played more holes', () => {
    const rows = sortStandings([
      standing({ teamId: 'fewer', holesPlayed: 9, finished: false, toPar: 2 }),
      standing({ teamId: 'more', holesPlayed: 14, finished: false, toPar: 2 }),
    ]);
    expect(rows.map((r) => r.teamId)).toEqual(['more', 'fewer']);
  });

  it('ranks by adjusted score when the match is final (byAdjusted)', () => {
    // Lowest gross would be A, but beers flip the final order to B.
    const rows = sortStandings(
      [
        standing({ teamId: 'A', grossStrokes: 80, beers: 2, adjustedScore: 78 }),
        standing({ teamId: 'B', grossStrokes: 82, beers: 10, adjustedScore: 72 }),
      ],
      true
    );
    expect(rows.map((r) => r.teamId)).toEqual(['B', 'A']);
  });

  it('does not mutate the input array', () => {
    const input = [
      standing({ teamId: 'b', adjustedScore: 2 }),
      standing({ teamId: 'a', adjustedScore: 1 }),
    ];
    const before = input.map((r) => r.teamId);
    sortStandings(input);
    expect(input.map((r) => r.teamId)).toEqual(before);
  });
});
