/* eShiksa (Dhaka College EMS, https://dhakacollege.eshiksabd.com) sync.
   Every student signs in to the college portal with the same user id and the common password the college gives out, then
   looks things up by class roll. On the phone, a hidden browser (android/…/PortalSyncPlugin.java) signs in and this module
   asks the portal's own endpoints for the student's profile, notices, fee receipts, exam list, result transcript and
   class routine. The password is typed into the portal's own form and goes only to the portal; the app never sees it
   unless the student ticks "Remember on this phone" (then it is stored encrypted in the Android keystore).
   Parsers work on HTML text (no DOM) so they run in the app and in Node tests. They keep academic fields only: no photo,
   phone, address or ID numbers. The only identifier kept is the class roll the student typed. */
export const PORTAL = "https://dhakacollege.eshiksabd.com";
export const LOGIN_USER = "dcstudent";
export const DASHBOARD = "/Basic-Result-Enquiry-Center";
export const STEPS = ["Opening the portal", "Reading your profile", "Reading notices, payments and exams"];

/* ───────── HTML → text ───────── */
const ENT = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&#039;": "'" };
const decode = (s) => s.replace(/&(nbsp|amp|lt|gt|quot|#0?39);/g, (m) => ENT[m] ?? m);
export const textOf = (h) => decode(String(h || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
export function tableRows(html) {
  return [...String(html || "").matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
    .map((m) => [...m[0].matchAll(/<(t[dh])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => ({ th: c[1].toLowerCase() === "th", html: c[2], text: textOf(c[2]) })))
    .filter((r) => r.length);
}
export function parseOptions(html) {
  return [...String(html || "").matchAll(/<option\b([^>]*)>([\s\S]*?)(?=<option\b|<\/option>|<\/select>|$)/gi)]
    .map((m) => ({ value: (m[1].match(/value\s*=\s*["']([^"']*)["']/i) || [])[1] ?? textOf(m[2]), label: textOf(m[2]) })).filter((o) => o.label);
}
/* The portal answers a failed lookup with a text that starts with "Error". */
export const isError = (resp) => /^\s*(<[^>]+>\s*)*error\b/i.test(String(resp || "")) || !String(resp || "").trim();
const norm = (s) => String(s || "").toLowerCase().replace(/\s*-\s*/g, "-").replace(/\s+/g, " ").trim();
export const pick = (pairs, label) => pairs.find(([, l]) => norm(l) === norm(label)) || null;
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function isoDate(s) {
  const m = String(s || "").match(/^(\d{1,2})[-\/ ]([A-Za-z]{3})[a-z]*[-\/ ](\d{4})$/);
  return m && MONTHS[m[2].toLowerCase()] ? `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}` : String(s || "");
}
export const ordinal = (n) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/* ───────── Parsers (academic fields only) ───────── */
export function parseProfile(html) {
  const m = textOf(html).match(/\bName\s*:\s*(.+?)\s+Department\s*:\s*(.+?)\s+Session\s*:\s*(\d{4}\s*-\s*\d{4})\s+Academic Year\s*:\s*(\d)/i);
  if (!m) return null;
  const subj = (t) => { const x = String(t || "").match(/^(\S+)\s*-\s*(.+)$/); return x ? { code: x[1], name: x[2].trim() } : null; };
  const subjects = [];
  for (const r of tableRows(html)) {
    if (r.length < 3 || /^subject type$/i.test(r[2].text)) continue;
    const first = subj(r[0].text);
    if (first) subjects.push({ type: r[2].text, first, second: subj(r[1].text), name: first.name.replace(/\s*1st paper$/i, "") });
  }
  return { name: m[1].trim(), department: m[2].trim(), session: m[3].replace(/\s+/g, ""), year: Number(m[4]), subjects };
}
export function parseReceipts(html) {
  const rows = tableRows(html), h = rows.find((r) => r.some((c) => /transaction no/i.test(c.text)));
  if (!h) return [];
  const at = (re) => h.findIndex((c) => re.test(c.text));
  const [iBank, iTrx, iDate, iType, iAmt] = [at(/bank|mfs/i), at(/transaction no/i), at(/transaction date/i), at(/fee type/i), at(/amount/i)];
  return rows.filter((r) => r !== h && r.length > Math.max(iBank, iTrx, iDate, iType, iAmt))
    .map((r) => ({ bank: r[iBank].text, trx: r[iTrx].text, date: isoDate(r[iDate].text), type: r[iType].text, amount: Number(r[iAmt].text.replace(/[^\d.]/g, "")) || 0 }))
    .filter((x) => x.trx);
}
const linksIn = (html) => [...new Set([...String(html || "").matchAll(/(?:src|href|data)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]).filter((u) => !/^(data:|javascript:|#)/i.test(u)).map((u) => { try { return new URL(u, PORTAL + "/").href; } catch { return ""; } }).filter(Boolean))];
export function parseNotices(html) {
  const out = []; let cur = null;
  for (const r of tableRows(html)) {
    if (r.length < 2) continue;
    const k = r[0].text.toLowerCase().replace(/:$/, "");
    if (!/^(title|description|department|content)$/.test(k)) continue;
    if (k === "title") { cur = { title: "", description: "", department: "", content: "", links: [] }; out.push(cur); }
    if (!cur) continue;
    if (k === "content") { cur.content = r[1].text.slice(0, 600); cur.links = linksIn(r[1].html); } else cur[k] = r[1].text;
  }
  if (!out.length) { // the page may use divs instead of a table
    for (const p of textOf(html).split(/\bTitle\b/).slice(1)) {
      const m = p.match(/^\s*(.*?)\s+Description\s+(.*?)\s+Department\s+(.*?)\s+Content\s*(.*)$/i);
      if (m) out.push({ title: m[1], description: m[2], department: m[3], content: m[4].slice(0, 600), links: [] });
    }
  }
  const seen = new Set();
  return out.filter((n) => n.title && !seen.has(n.title + "|" + n.department) && seen.add(n.title + "|" + n.department));
}

/* ───────── Scripts that run inside the portal page (same site, the student's own session) ───────── */
const HELPERS = "const post = async (f, d) => { const r = await fetch('controller_student_module.php', { method: 'POST', credentials: 'include',"
  + " headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },"
  + " body: new URLSearchParams({ ...d, flagreq: f }) }); if (!r.ok) throw new Error('The portal answered ' + r.status); "
  + "return (await r.text()).replace(/<img[^>]*>/gi, '').replace(/data:[^\"')\\s]{200,}/g, 'data:omitted'); };";
const wrap = (body) => "(() => { window.__dc = null; (async () => { try { " + HELPERS + " " + body + " } catch (e) { window.__dc = { ok: false, error: String((e && e.message) || e) }; } })(); return 'started'; })()";
export const scripts = {
  lists: "JSON.stringify({ dept: [...document.querySelectorAll('#departmentList option')].map((o) => [o.value, o.textContent.trim()]),"
    + " sess: [...document.querySelectorAll('#sessionID option')].map((o) => [o.value, o.textContent.trim()]) })",
  posts: (steps) => wrap("const out = []; for (const [f, d] of " + JSON.stringify(steps) + ") out.push(await post(f, d).catch((e) => 'Error: ' + e.message)); window.__dc = { ok: true, out };"),
  pdf: (path) => wrap("const u = new URL(" + JSON.stringify(path) + ", location.href); if (u.origin !== location.origin) throw new Error('Unexpected link');"
    + " const r = await fetch(u.href, { credentials: 'include' }); if (!r.ok) throw new Error('The portal answered ' + r.status);"
    + " const buf = new Uint8Array(await r.arrayBuffer()); if (buf.length > 2500000) throw new Error('The PDF is too large to open here.');"
    + " let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));"
    + " if (s.slice(0, 4) !== '%PDF') throw new Error('NOPDF'); window.__dc = { ok: true, b64: btoa(s) };")
};
async function run(bridge, script, timeout = 40000) {
  const r = await bridge.exec({ script, waitJs: "window.__dc ? 'yes' : 'no'", result: "JSON.stringify(window.__dc || null)", timeout });
  const v = JSON.parse(r.result || "null");
  if (!v || v.ok === false) throw new Error((v && v.error) || "The portal didn't answer. Check your internet and try again.");
  return v;
}

/* ───────── Sign-in and sync ───────── */
export async function signIn(bridge, { password = "", useSaved = false } = {}) {
  const st = await bridge.open();
  if (st && st.login === false) return st; // already signed in on this phone
  const r = await bridge.login({ username: LOGIN_USER, password, useSaved });
  if (r && r.login) throw new Error(r.error || "The password wasn't accepted. Check it and try again.");
  return r;
}
export const openDashboard = (bridge) => bridge.read({ path: DASHBOARD, waitFor: "Academic Result", timeout: 15000, script: scripts.lists });

export async function syncAll(bridge, { roll, password = "", useSaved = false, onStep = () => {} }) {
  roll = String(roll || "").trim();
  if (!/^\d{6,20}$/.test(roll)) throw new Error("Enter your class roll (numbers only).");
  onStep(STEPS[0]);
  await signIn(bridge, { password, useSaved });
  const page = await openDashboard(bridge);
  const lists = JSON.parse(page.result || "{}");
  if (!lists.dept || !lists.dept.length) throw new Error("The portal's home page didn't load. Try again in a minute.");
  onStep(STEPS[1]);
  const prof = parseProfile((await run(bridge, scripts.posts([["profileRollCheck", { rootData: roll }]]))).out[0]);
  if (!prof) throw new Error("No student was found for that class roll. Check the number.");
  const dept = pick(lists.dept, prof.department), sess = pick(lists.sess || [], prof.session);
  const warnings = [];
  if (!dept) warnings.push("Your department wasn't found in the portal's list, so notices and exams are limited.");
  onStep(STEPS[2]);
  const steps = [["transactionCheck", { rootData: roll }], ["noticeBoardContent", { rootData: dept ? dept[0] : "0" }], ["noticeBoardContent", { rootData: "0" }],
    ["searchExamList", { rootData: dept ? dept[0] : "0", sessionID: sess ? sess[0] : "" }]];
  const out = (await run(bridge, scripts.posts(steps))).out;
  const notices = parseNotices([out[1], out[2]].filter((x) => !isError(x)).join("\n"));
  const exams = isError(out[3]) ? [] : parseOptions(out[3]).filter((o) => o.value && o.value !== "0");
  return { roll, name: prof.name, department: prof.department, session: prof.session, year: prof.year, subjects: prof.subjects,
    notices, receipts: isError(out[0]) ? [] : parseReceipts(out[0]), exams, deptId: dept ? dept[0] : "", sessionId: sess ? sess[0] : "", warnings, syncedAt: Date.now() };
}

/* PDFs (transcript, routine) come back as base64 for PortalSync.openPdf, which opens the phone's PDF viewer. */
export async function fetchTranscript(bridge, { roll, examId }) {
  const [perm] = (await run(bridge, scripts.posts([["checkTranscriptPermission", { rootData: examId, stClassRoll: roll }]]))).out;
  if (isError(perm)) throw new Error(textOf(perm).replace(/^error:?\s*/i, "") || "The transcript isn't available for this exam yet.");
  const [url] = (await run(bridge, scripts.posts([["checkStudentTranscript", { rootData: roll, examList: examId }]]))).out;
  if (isError(url)) throw new Error(textOf(url).replace(/^error:?\s*/i, "") || "The transcript isn't available for this exam yet.");
  return pdf(bridge, String(url).trim());
}
export async function fetchRoutine(bridge, { sessionId, deptId, year }) {
  if (!sessionId || !deptId) throw new Error("Your session or department wasn't found. Sync again.");
  const [a, b] = (await run(bridge, scripts.posts([["ajaxEncryption", { rootData: sessionId }], ["ajaxEncryption", { rootData: deptId }]]))).out.map((x) => String(x).trim());
  if (!a || !b || isError(a) || isError(b)) throw new Error("The routine isn't available right now.");
  return pdf(bridge, `class_routine_pdf.php?sessionID=${a}&facultyID=${b}&academicYear=${year || 1}`, "The routine isn't published yet.");
}
async function pdf(bridge, path, missing = "The portal didn't return a PDF.") {
  try { return await run(bridge, scripts.pdf(path), 60000); }
  catch (e) { throw new Error(/NOPDF/.test(e.message) ? missing : e.message); }
}
