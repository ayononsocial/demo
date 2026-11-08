# Publishing DC Legacy on Netlify

The website and web app go on Netlify. College portal sync, reminders and PDFs work only in the Android app (a browser can't sign in to the college portal for you).

## 1. Set up the backend (Supabase), once
Needed for accounts, clubs, the study vault, events and the other shared features. Without it the web app still opens and works on your own device only.
1. Create a free project at supabase.com.
2. In **SQL editor**, run every file in `supabase/migrations/` in number order (`0001` to `0027`). Or use `app/scripts/setup-supabase.mjs` (see its header).
3. **Authentication → Providers → Email**: turn on "Confirm email" with the 6-digit code (OTP) option.
4. **Project settings → API**: copy the **Project URL** and the **anon public key**.
5. Make your admin account: sign up in the app with your email, then follow `store/RELEASE.md` ("admin invite") or insert your email into the `admin_invites` table before signing up.

## 2. Put the code on GitHub
1. Create a GitHub repo named `dc-legacy` (private is fine).
2. Unzip `DC-Legacy-final.zip`, then upload the **contents** (the folders `app`, `supabase`, `store`, `brand`, and the files `netlify.toml`, `README.md`...) to the repo root. Use GitHub's "Add file → Upload files", or git.

## 3. Deploy on Netlify
1. Sign in at netlify.com with GitHub → **Add new site → Import an existing project → GitHub** → pick `dc-legacy`.
2. Netlify reads `netlify.toml`, so the settings are already filled: base `app`, build command `npm run build`, publish directory `dist`, Node 22. Leave them.
3. Open **Site configuration → Environment variables** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
   - `VITE_SITE_URL` = your final site address (for example `https://dc-legacy.netlify.app`)
   - `VITE_GOOGLE_CLIENT_ID` = optional, only for Google Classroom import
4. Click **Deploy**. The first build takes a few minutes. Your site is live at `https://<random-name>.netlify.app`; rename it under **Site configuration → Change site name**.
5. In Supabase: **Authentication → URL Configuration** → set **Site URL** to your Netlify address and add it to the redirect URLs.

## 4. The Android app and the download button
Easy way, no Android Studio and no secrets needed:
1. On GitHub open your repo → **Actions** tab → **Build APK** (left list) → **Run workflow** → green **Run workflow** button.
2. Wait about 10 minutes until it shows a green tick. Your repo now has a **Release** (right side of the repo page) with `dc-legacy.apk`.
3. The website's **Download for Android** button (`netlify.toml` points at `github.com/ayononsocial/dc-legacy/releases/latest/download/dc-legacy.apk`) now works. On your phone, download the file and open it. Allow "install unknown apps" for your browser when Android asks.
4. Test the sync: Menu → College portal → class roll and college password → Sync.
Optional: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repo secrets (Settings → Secrets and variables → Actions) so the app can sign in. Rerun **Build APK** after that.
Google Play needs the signed "Android release" workflow instead (see `store/RELEASE.md`).

## Optional
- Custom domain: **Domain management → Add a domain** in Netlify.
- Every `git push` to the main branch redeploys the site automatically.
- Without GitHub: run `npm install` and `npm run build` inside `app/` on your computer, then drag the `app/dist` folder onto https://app.netlify.com/drop. Environment variables must be set in a `.env` file in `app/` before building (copy `.env.example`). The redirects and headers in `netlify.toml` don't apply to a drag-and-drop deploy of `dist` alone, so copy `netlify.toml` into `dist` too.
