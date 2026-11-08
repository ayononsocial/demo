## College update (no university credits)

- Grade scale is now the Bangladesh college scale, GPA out of **5.00**: A+ 5.00, A 4.00, A- 3.50, B 3.00, C 2.00, D 1.00, F 0.00.
- GPA is per subject (no credits): the average grade point of compulsory subjects. A **4th (optional) subject** adds only its points above 2.00. An F in a compulsory subject makes the GPA 0.00 (fail).
- GPA Calculator (`#/whatif`) rebuilt around subjects, grades and the 4th-subject tick box.
- My GPA page, analytics and assistant now show subjects/terms instead of credits, degree progress and credit planners.
- Removed from the app: Degree Progress, Scholarship bands, Advising planner (old links redirect to `#/grades`), "credits required" profile field. Profile now asks for group, section, class teacher and class (XI / XII).
- Demo data switched to college subjects.
- Not changed: the portal sync parser still reads credit/CGPA text if the portal sends it, and the demo class routine/faculty sample data are unchanged.

## GPA update

- Removed the CGPA / What-If calculator (semester, target CGPA and credit planner tabs).
- Added a simple **GPA Calculator** (`#/whatif`): enter each course, its credits and grade to get your GPA out of 4.00.
- Renamed "CGPA" to "GPA" in all visible text (nav, home, analytics, scholarship, assistant, study cards, privacy/terms, manifest).
- Internal names (`cgpaOf`, `profile.cgpa`) and the portal parser still read "CGPA" so syncing keeps working.

# DC Legacy: changes from EWUdiots (final)

## Done
- Name, ids and text: EWUdiots → DC Legacy, East West University / EWU → Dhaka College (171 files). appId `com.dclegacy.app`, Java package moved.
- Logo, colours: red `#b92726` (primary) and sky blue `#20bced` taken from the DC logo. All icons, splash screens, notification icon, store graphics regenerated (`brand/make_icons.py`).
- Login: any valid email works for everyone. Student-ID sign-in, student-email rule and ID-card scan removed from the sign-in UI. New migration `0027_open_signup.sql`.
- Removed: `UI Design/`, Chrome `extension/`, EWU store screenshots, Supabase `functions/`, EWU club/faculty/alumni data, EWU scrape/probe scripts, EWU feed cron and workflow, `PLAN.md`.
- Hidden: Advising Planner, Scholarships, Faculty directory, Free rooms, Academic calendar, Fees (menu entries removed); News, Notices, Alumni stories, Campus map, ID card (switched off by default in `content.js`, admin can switch on).

## Phase 2: eShiksa sync (new)
- `app/src/eshiksa.js`: signs in to https://dhakacollege.eshiksabd.com with the shared user id `dcstudent` and the common password (typed by the student, optionally remembered encrypted on the phone), then asks the portal's own endpoints (`controller_student_module.php`: `profileRollCheck`, `noticeBoardContent`, `transactionCheck`, `searchExamList`, `checkTranscriptPermission`, `checkStudentTranscript`, `ajaxEncryption` + `class_routine_pdf.php`) for the student's profile, subjects, notices, fee receipts, exam list, result transcript (PDF) and class routine (PDF). Keeps academic fields only, no photo or phone/address.
- `app/src/ui-sync.js`: new "College portal" page (`#/sync`, also in the menu). Class roll + password, Sync, then profile, transcript and routine buttons (open as PDF in the phone's viewer), notices, payments, subjects. Android app only.
- `PortalSyncPlugin.java`: now targets the eShiksa login form (`form.form-signin`, fields `username`/`password`, no check question) and has `openPdf`.
- `app/tests/eshiksa.test.js`: 8 tests (parsers, sync order, wrong roll/password, blocked/missing PDFs).
- Removed the old EWU sync: `portalsync.js`, `portal-scrape.js`, old multi-method sync UI (screenshot, paste, extension).
- Hidden for now: CGPA and Analytics (built on the credit-based 4.00 scale; need a Dhaka College GPA design, e.g. from the transcript data).
- Privacy policy and terms updated for the eShiksa sync (Chrome extension, Smart scan and email-domain text removed).

## Download and brand fixes
- "Build APK" GitHub Action (no secrets): builds a debug-signed `dc-legacy.apk` and publishes it as a Release; the website Download button points at it. "Android release" (signed, Play) is now manual only.
- Fixed "Dhaka Collegediots" brand text everywhere (now DC Legacy). Home tiles for hidden pages removed. EWU campus banner replaced by a plain red banner with the crest.

## Developer card
- About/More page now shows Samiul Ahmed Ayon, DC-25 batch, with the supplied photo (`app/public/img/dev-ayon.webp`). The old developer photos and GitHub/LinkedIn links are removed.

## Final pass (Netlify)
- `netlify.toml` (build, headers, redirects) and `DEPLOY.md` (step by step). `vercel.json`, the Vercel `api/` functions, the feed cron and the EWU news/notice dev middleware in `vite.config.js` are gone.
- New landing page (`index.html`, `src/site.js`): only claims what the app really does. The old one advertised the EWU 3D campus, live ewubd.edu notices, 400 faculty and alumni stories.
- Fixed broken names/URLs left by the rename (APK/AAB file names, GitHub release links, `DC Legacy` with a space in URLs). Download link in `netlify.toml` needs your GitHub username.
- Profile page and assistant no longer send people to the Chrome extension or screenshot sync; FAQ updated.
- `0027_open_signup.sql` also drops the old `@ewubd.edu` check on faculty emails.

## Not verified (no network or Android build here)
- The website was never built here (no npm install possible). Netlify will run `vite build` on its first deploy: if it fails, the build log shows the line, send it to me.
- The parsers were written from screenshots, and the tests use synthetic HTML. The portal's real responses may differ: run a real sync on a phone and send me what fails.
- Transcript and routine are opened as PDFs, not parsed. The routine isn't published on the portal at the moment, so that path is untested even in principle.
- `PortalSyncPlugin.java` and `0027_open_signup.sql` were not compiled or run.
- Notices are read for the student's department plus "All Department". Notice attachments are opened by link; whether those links work without the portal session is unknown.

## Still open
- Old code left in place but unused or hidden: `parser.js`, `ocr.js`, Planner/Scholarship/Calendar/Fees pages, EWU campus map data, newsletter and feed code, `0007`/`0016` SQL seeds. Delete when sure.
- CGPA/Analytics for Dhaka College (grade scale seen on the transcript: A+ 80-100 = 5.00, A 70-79 = 4.00, A- 60-69 = 3.50, B 50-59 = 3.00, F 0-49 = 0).
- `index.html` landing copy, photos in `app/public/img`, the ID-card photo row in the privacy policy (ID card page is off by default), Play listing text, Supabase and Vercel setup, Play screenshots.
- The faculty-directory email column still has the old `@ewubd.edu` check (migration 0001).
