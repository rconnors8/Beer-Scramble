export const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);
export const TOTAL_HOLES = 18;
export const MAX_BEERS = 30;
export const MAX_TEAMS = 8;
export const MIN_STROKES = 1;
export const MAX_STROKES = 10;

export type Match = {
  id: string;
  name: string;
  match_code: string;
  course_name: string | null;
  owner_user_id: string;
  created_at: string;
};

export type Team = {
  id: string;
  match_id: string;
  team_name: string;
  members_label: string | null;
  owner_user_id: string;
  created_at: string;
};

export type HoleScore = {
  id: string;
  team_id: string;
  hole_number: number;
  strokes: number;
  par: number | null;
  submitted_at: string;
};

export type BeerLog = {
  id: string;
  team_id: string;
  logged_at: string;
};
