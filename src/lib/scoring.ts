import { MAX_BEERS, TOTAL_HOLES, type HoleScore } from './types';

export type TeamStanding = {
  teamId: string;
  teamName: string;
  membersLabel: string | null;
  holesPlayed: number;
  finished: boolean;
  status: string; // "F" or "Thru N"
  grossStrokes: number;
  beers: number; // capped at MAX_BEERS for the deduction
  adjustedScore: number; // gross - beers
};

/**
 * Adjusted score = total strokes − total beers (beers capped at 30).
 * Status is "F" once all 18 holes are in, otherwise "Thru N".
 */
export function buildStanding(
  team: { id: string; team_name: string; members_label: string | null },
  scores: HoleScore[],
  beerCount: number
): TeamStanding {
  const grossStrokes = scores.reduce((sum, s) => sum + s.strokes, 0);
  const holesPlayed = scores.length;
  const finished = holesPlayed >= TOTAL_HOLES;
  const beers = Math.min(beerCount, MAX_BEERS);
  return {
    teamId: team.id,
    teamName: team.team_name,
    membersLabel: team.members_label,
    holesPlayed,
    finished,
    status: finished ? 'F' : `Thru ${holesPlayed}`,
    grossStrokes,
    beers,
    adjustedScore: grossStrokes - beers,
  };
}

/**
 * Sort by adjusted score ascending (lowest wins). Teams that haven't teed off
 * sink to the bottom; ties break toward whoever has played more holes.
 */
export function sortStandings(rows: TeamStanding[]): TeamStanding[] {
  return [...rows].sort((a, b) => {
    if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
    if (a.holesPlayed === 0) return 1;
    if (b.holesPlayed === 0) return -1;
    return a.adjustedScore - b.adjustedScore || b.holesPlayed - a.holesPlayed;
  });
}
