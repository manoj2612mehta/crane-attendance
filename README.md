# Crane Operator Attendance Ledger — ONGC Offshore

Live boarding/deboarding ledger for crane operators across offshore platforms.
Per-platform login (Supabase Auth), row-level authorization, real-time headcount,
auto-calculated days onboard (calendar days, boarding day = day 1).

Design & Created by **Manoj Mehta**

---

## What it does
- **Board / Deboard** an operator on a platform → two timestamps per trip.
- **Days onboard** = calendar days from boarding date to today, auto-calculated.
- **Operations overview** → live count of who is onboard, per platform + totals.
- **Per-platform authorization** → an in-charge can only board/deboard on the
  platform(s) they are assigned to (enforced by Postgres RLS, not just the UI).
- **Real-time** → the dashboard updates the moment anyone boards/deboards.

## Setup (one time)

### 1. Supabase project
- Create a project at supabase.com.
- Open SQL Editor → paste all of supabase_schema.sql → Run.

### 2. Create in-charge accounts
- Supabase → Authentication → Add user (email + password) per in-charge.
- Copy each UUID, then assign (see commented block in supabase_schema.sql):

    insert into platform_incharges (user_id, platform_id, incharge_name)
    values ('<AUTH_USER_UUID>', (select id from platforms where code='NH-01'), 'Name');

One user can manage multiple platforms — the console shows a switcher.

### 3. Frontend keys
Copy .env.example to .env and fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
(Project → Settings → API).

### 4. Run / deploy
    npm install
    npm run dev
    npm run build   # → dist/ , deploy to Netlify

## Roster management
- Add operators: insert into operators.
- Retire: set active = false (keeps history).
- Add platforms: insert into platforms, then assign an in-charge.

## Notes
- Partial unique index guarantees an operator is onboard only ONE platform at a time.
- Day count uses IST (Asia/Kolkata).
