import { MAX_BEERS, TOTAL_HOLES, type HoleScore } from './types';
import { parForHole } from './course';

export type TeamStanding = {
  teamId: string;
  teamName: string;
  membersLabel: string | null;
  startNine: string | null;
  holesPlayed: number;
  finished: boolean;
  status: string; // "F" or "Thru N"
  grossStrokes: number;
  toPar: number | null; // gross − par over played holes; null if no starting nine
  beers: number; // capped at MAX_BEERS for the deduction
  adjustedScore: number; // gross - beers (the metric that wins the league)
};

/**
 * Adjusted score = total strokes − total beers (beers capped at 30) — still the
 * winning metric. To-par = gross strokes − par over the holes played, using the
 * team's starting nine to know each hole's par (standard golf; "E" at even).
 */
export function buildStanding(
  team: { id: string; team_name: string; members_label: string | null; start_nine: string | null },
  scores: HoleScore[],
  beerCount: number
): TeamStanding {
  const grossStrokes = scores.reduce((sum, s) => sum + s.strokes, 0);
  const holesPlayed = scores.length;
  const finished = holesPlayed >= TOTAL_HOLES;
  const beers = Math.min(beerCount, MAX_BEERS);

  let toPar: number | null = null;
  if (team.start_nine) {
    const parPlayed = scores.reduce(
      (sum, s) => sum + (parForHole(team.start_nine, s.hole_number) ?? 0),
      0
    );
    toPar = grossStrokes - parPlayed;
  }

  return {
    teamId: team.id,
    teamName: team.team_name,
    membersLabel: team.members_label,
    startNine: team.start_nine,
    holesPlayed,
    finished,
    status: finished ? 'F' : `Thru ${holesPlayed}`,
    grossStrokes,
    toPar,
    beers,
    adjustedScore: grossStrokes - beers,
  };
}

/**
 * Sort standings, lowest wins. During play we rank by gross strokes (beers stay
 * hidden until every team finishes); once the match is over we rank by the
 * beer-adjusted score, which decides the real winner. Teams that haven't teed
 * off sink to the bottom; ties break toward whoever has played more holes.
 */
export function sortStandings(rows: TeamStanding[], byAdjusted = false): TeamStanding[] {
  return [...rows].sort((a, b) => {
    if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
    if (a.holesPlayed === 0) return 1;
    if (b.holesPlayed === 0) return -1;
    const primary = byAdjusted
      ? a.adjustedScore - b.adjustedScore
      : a.grossStrokes - b.grossStrokes;
    return primary || b.holesPlayed - a.holesPlayed;
  });
}
