# Golf Beer League 🍺⛳

Live scoring for a golf beer league. Friends form 2-person teams, play 18 holes
in order, and share one pool of **30 beers** per round. Every beer logged
**deducts a point** from the team's stroke total.

> **Adjusted score = total strokes − total beers (max 30). Lowest wins.**

One person per team ("team rep") runs the app for their team, logging both scores
and beers. Anyone with the link can watch the leaderboard without signing in.

## What's enforced (and where)

Nothing important is guarded only in the UI — it's all in the database:

- **Scores are permanent.** `hole_scores` has a `unique (team_id, hole_number)`
  constraint and **no** update/delete policy, so a submitted hole can never be
  changed or removed. The confirmation modal is the only safeguard.
- **30-beer hard cap** — enforced atomically by the `log_beer` RPC, not just a
  disabled button.
- **8 teams per match max** — enforced atomically by the `join_team` RPC, which
  also returns your existing team instead of creating a duplicate.
- **Auth** is 100% Supabase Auth + Google OAuth. No passwords, PINs, or custom
  credential logic. Sessions persist until you sign out.
- **Reads are public** (spectators + leaderboard use the anon key); **writes** are
  gated by RLS keyed on `auth.uid()`.
- No `active`/`completed` flag exists on a match — a team shows **"F"** once it
  has all 18 holes in, and the match is implicitly over when every team is "F".
- **Starting nine & par.** Colonie Town has four 9-hole loops (Red / Blue /
  White / Green — 36 holes total, each nine par 36). An 18-hole round is a
  **starting nine + the next color in the loop**, because the course loops back:
  **Green → Red → Blue → White → Green**. So starting on Green plays Green then
  Red; starting on Blue plays Blue then White. Each team picks their starting
  nine when they join; scores are shown relative to par (**E / +3 / −2**) live on
  the leaderboard so every team sees who's over/under. Course data lives in
  `src/lib/course.ts`. The beer-**adjusted** score (gross − beers) still wins the
  league.

The one action the spec's SQL didn't cover directly is the beer **Undo**. Since
`beer_logs` has no delete policy, undo goes through a small `undo_last_beer`
`security definer` RPC that removes the caller's most recent beer within the
~8-second toast window. Beers are explicitly undoable; only *scores* are immutable.

## Tech stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**, mobile-first.
- **Supabase** (hosted Postgres) — DB, auth, and realtime.
- Client-side writes via the Supabase JS SDK; atomic caps via Postgres RPCs.
- **Supabase Realtime** on the leaderboard and team dashboard, with a 15s polling
  fallback.

## Routes

| Route | Who | Purpose |
|-------|-----|---------|
| `/` | anyone | Sign in, create a match, or open a code |
| `/create` | signed in | Create a match, get the join + leaderboard links |
| `/join/[match_code]` | signed in | Set up your team (or jump to it if you already have one) |
| `/team/[match_code]` | team owner | Scorecard + beer logging |
| `/match/[match_code]` | public | Live leaderboard |

## Setup

### 1. Create the Supabase project & run the migration

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. Open the **SQL editor** and run the contents of
   [`supabase/migration.sql`](supabase/migration.sql). This creates the tables,
   RLS policies, and the `join_team` / `log_beer` / `undo_last_beer` RPCs.

### 2. Set up Google OAuth (required manual step)

Google sign-in needs an OAuth client — this is not automatic:

1. In [Google Cloud Console](https://console.cloud.google.com/) → *APIs &
   Services → Credentials*, create an **OAuth 2.0 Client ID** (type: *Web
   application*).
2. Add this authorized redirect URI:
   `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
3. In Supabase → *Authentication → Providers → Google*, enable Google and paste
   in the **Client ID** and **Client secret**.
4. In Supabase → *Authentication → URL Configuration*, set the **Site URL** to
   your app's URL and add your local (`http://localhost:3000`) and Vercel URLs to
   **Redirect URLs**.

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in from Supabase → *Project Settings → API*:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

### 4. Run locally

```bash
npm install
npm run dev
# http://localhost:3000
```

### 5. Deploy to Vercel

1. Push this repo and import it in [Vercel](https://vercel.com).
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as project
   environment variables.
3. Deploy, then add the Vercel URL to Supabase's **Redirect URLs** (step 2.4).

## Out of scope for v1

Score editing/correction (deliberate), passwords/PINs, GPS/course mapping, shot
tracking, handicaps, season history, and payments.
