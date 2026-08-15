import { TOTAL_HOLES, type HoleScore } from './types';
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
  beers: number; // total beers logged (no cap)
  adjustedScore: number; // gross - beers (net strokes)
  netToPar: number | null; // toPar − beers: net score to par (the ranking metric)
};

/**
 * To-par = gross strokes − par over the holes played (standard golf; "E" at
 * even). Net to par = to-par − beers: the beer-adjusted score expressed relative
 * to par, which is what ranks the leaderboard (hole-count independent).
 */
export function buildStanding(
  team: { id: string; team_name: string; members_label: string | null; start_nine: string | null },
  scores: HoleScore[],
  beerCount: number
): TeamStanding {
  const grossStrokes = scores.reduce((sum, s) => sum + s.strokes, 0);
  const holesPlayed = scores.length;
  const finished = holesPlayed >= TOTAL_HOLES;
  const beers = beerCount;

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
    netToPar: toPar == null ? null : toPar - beers,
  };
}

/**
 * Sort standings by net score to par (to-par − beers), lowest wins — E beats +1
 * regardless of how many holes each team has played. Teams that haven't teed off
 * sink to the bottom; ties break toward whoever has played more holes.
 */
export function sortStandings(rows: TeamStanding[]): TeamStanding[] {
  const netKey = (r: TeamStanding) => r.netToPar ?? Number.POSITIVE_INFINITY;
  return [...rows].sort((a, b) => {
    if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
    if (a.holesPlayed === 0) return 1;
    if (b.holesPlayed === 0) return -1;
    return netKey(a) - netKey(b) || b.holesPlayed - a.holesPlayed;
  });
}
