# Beer-Scramble 🍺⛳

Live scoring for a golf scramble. Every group plays holes **1 → 18 in order**,
tracks its beers, and shows up on a shared leaderboard in real time.

There's **no custom backend**: the browser talks directly to Supabase, and every
rule is enforced by Postgres (constraints + Row Level Security), not by app code
someone could bypass.

## How it works

- **Sign in with Google** (Supabase Auth). Sessions persist, so you stay signed
  in on your device — no PINs, no passwords.
- **Sequential play, submit any time.** The scorecard highlights your current
  hole (lowest one not yet entered), but you can submit any hole whenever you get
  to it — handy for entering a hole late.
- **Scores are final.** Submitting a hole shows one confirm dialog
  (`Hole 7: score of 5 — Confirm?`). After that it's locked forever — there is
  no edit for anyone, including the match creator. Enforced server-side: `scores`
  is insert-only under RLS with a `unique (team_id, hole)` constraint.
- **30-beer hard cap.** A `CHECK (beer_count <= 30)` constraint plus a guard
  trigger enforce the ceiling in the database; the button just disables at 30.
- **Team names can collide** — no uniqueness check.
- **"F" when done.** A team shows `F` on the leaderboard once it submits hole 18.
  There's no manual "match over" toggle.

## Prerequisites

1. **A Supabase project** (free tier is fine).
2. **A Google OAuth client** — Google sign-in requires this, and it's the one
   external setup step you can't skip:
   - In [Google Cloud Console](https://console.cloud.google.com/) → *APIs &
     Services → Credentials*, create an **OAuth 2.0 Client ID** (type: *Web
     application*).
   - Add your Supabase auth callback as an authorized redirect URI:
     `https://<YOUR-PROJECT>.supabase.co/auth/v1/callback`.
   - Copy the **Client ID** and **Client secret** into Supabase → *Authentication
     → Providers → Google*, and enable the provider.
   - Under Supabase → *Authentication → URL Configuration*, set the **Site URL**
     (and add any deploy/localhost URLs to *Redirect URLs*) so the OAuth
     redirect lands back on the app.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#    then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
#    (Supabase → Project Settings → API)

# 3. Create the database schema
#    Paste supabase/schema.sql into the Supabase SQL editor and run it
#    (or: supabase db push)

# 4. Run it
npm run dev
```

Build for production with `npm run build` (outputs static files in `dist/` — host
anywhere: Netlify, Vercel, GitHub Pages, etc.).

## Project layout

```
supabase/schema.sql   Tables, constraints, RLS policies, guard trigger (the rules)
src/lib/supabase.ts   Supabase client (persisted sessions)
src/lib/useAuth.ts    Google sign-in / sign-out hook
src/views/SignIn.tsx  Google sign-in screen
src/views/Home.tsx    Create / join a match
src/views/Match.tsx   Scorecard, beer counter, live leaderboard
```

## Notes

- **A confirmed fat-finger is permanent.** With no edit path anywhere, a wrong
  score you confirm is final by design. The confirm dialog is the only safeguard.
- Anyone in the match can record scores for any team (one phone per group is the
  expected use). Tighten the `teams`/`scores` RLS policies if you need per-team
  ownership.
