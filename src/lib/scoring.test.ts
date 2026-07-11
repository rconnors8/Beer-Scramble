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

const team = (id: string, name = id) => ({
  id,
  team_name: name,
  members_label: null,
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

  it('caps the beer deduction at 30 even if more are logged', () => {
    const s = buildStanding(team('a'), scores('a', 18, 4), 45);
    // gross = 72, beers capped at 30 -> adjusted 42
    expect(s.beers).toBe(30);
    expect(s.adjustedScore).toBe(42);
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
});

describe('sortStandings', () => {
  const standing = (over: Partial<TeamStanding> & { teamId: string }): TeamStanding => ({
    teamName: over.teamId,
    membersLabel: null,
    holesPlayed: 18,
    finished: true,
    status: 'F',
    grossStrokes: 0,
    beers: 0,
    adjustedScore: 0,
    ...over,
  });

  it('orders by adjusted score ascending (lowest wins)', () => {
    const rows = sortStandings([
      standing({ teamId: 'hi', adjustedScore: 50 }),
      standing({ teamId: 'lo', adjustedScore: 40 }),
      standing({ teamId: 'mid', adjustedScore: 45 }),
    ]);
    expect(rows.map((r) => r.teamId)).toEqual(['lo', 'mid', 'hi']);
  });

  it('sinks teams that have not teed off to the bottom', () => {
    const rows = sortStandings([
      standing({ teamId: 'notStarted', holesPlayed: 0, finished: false, adjustedScore: 0 }),
      standing({ teamId: 'playing', holesPlayed: 3, finished: false, adjustedScore: 12 }),
    ]);
    expect(rows.map((r) => r.teamId)).toEqual(['playing', 'notStarted']);
  });

  it('breaks ties toward the team that has played more holes', () => {
    const rows = sortStandings([
      standing({ teamId: 'fewer', holesPlayed: 9, finished: false, adjustedScore: 30 }),
      standing({ teamId: 'more', holesPlayed: 14, finished: false, adjustedScore: 30 }),
    ]);
    expect(rows.map((r) => r.teamId)).toEqual(['more', 'fewer']);
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
