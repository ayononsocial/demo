# DC Legacy

Student app for Dhaka College: students, clubs and alumni in one place. Built from the codebase
(Vite + vanilla JS, Capacitor for Android, Supabase backend, Vercel hosting).

Status: rebrand, clean-up and a first eShiksa sync (profile, notices, receipts, exam list, transcript and routine PDFs) are in. The sync has not been tried against the real portal yet.
See `CHANGES.md` for what changed and what is still open.

- `app/`: the web app and Android project (`app/android`, appId `com.dclegacy.app`)
- `supabase/migrations/`: database. `0027_open_signup.sql` lets anyone sign up with a valid email
- `brand/`: logo and `make_icons.py`, which regenerates every icon, splash and store graphic from `brand/logo.png`
- `store/`: Play Store listing text and graphics (screenshots must be recreated)
