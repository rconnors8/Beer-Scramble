export type Match = {
  id: string;
  name: string;
  join_code: string;
  created_by: string;
  created_at: string;
};

export type Team = {
  id: string;
  match_id: string;
  name: string;
  beer_count: number;
  created_by: string;
  created_at: string;
};

export type Score = {
  id: string;
  team_id: string;
  match_id: string;
  hole: number;
  strokes: number;
  created_by: string;
  created_at: string;
};

export const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);
export const MAX_BEERS = 30;
export const MIN_STROKES = 1;
export const MAX_STROKES = 20;
