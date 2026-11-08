/* College portal page (#/sync): sign in to the Dhaka College eShiksa portal on the phone (Android app) and keep the
   student's profile, notices, payments, exam list, result transcript and class routine. See src/eshiksa.js. */
import * as E from "./eshiksa.js";

export function install(ctx) {
  const { pages, icon, esc, $, toast } = ctx;
  const S = () => ctx.S;
  const bridge = () => ctx.native.PortalSync;
  const can = () => ctx.native.canPortalSync();
  let busy = false, run = null, saved = { saved: false }, savedAsked = false;
  const form = { roll: "", pw: "", remember: true, exam: "" };
  const repaint = () => { if (ctx.route() === "sync") ctx.rerender(); };
  const yen = (n) => `৳${Number(n || 0).toLocaleString("en-US")}`;

  const formCard = () => `<section class="card mt stack">
    <label class="field">Class roll<input class="input" id="es-roll" inputmode="numeric" autocomplete="off" value="${esc(form.roll || S().eshiksa?.roll || "")}" placeholder="Your class roll number"></label>
    <label class="field">Portal password<input class="input" id="es-pw" type="password" autocomplete="off" value="${esc(form.pw)}" placeholder="${saved.saved ? "Remembered on this phone (leave empty to use it)" : "The common password the college gave you"}"></label>
    <label class="row small" style="gap:8px"><input type="checkbox" class="check" id="es-rem" ${form.remember ? "checked" : ""}> Remember the password on this phone (encrypted)</label>
    ${run?.error ? `<p class="small" style="color:var(--error-t)" role="alert">${esc(run.error)}</p>` : ""}
    ${busy ? `<div class="stack small muted">${E.STEPS.map((s, i) => `<div>${i < (run?.steps?.length || 0) ? icon("check") : "·"} ${esc(s)}${i === (run?.steps?.length || 1) - 1 ? "…" : ""}</div>`).join("")}</div>` : ""}
    <button class="btn primary lg block" id="es-go" ${busy ? "disabled" : ""}>${icon("reset")} ${S().eshiksa ? "Sync again" : "Sync now"}</button>
    <p class="xs muted">You sign in on this phone. The password goes only to the Dhaka College portal, never to DC Legacy. Unofficial app, not affiliated with Dhaka College.${saved.saved ? ` <button type="button" class="lnk" id="es-forget">Forget the remembered password</button>` : ""}</p></section>`;
  const noNative = () => `<section class="card mt"><b>Syncing works in the Android app</b><p class="small muted">The college portal can't be opened from a website. Install the DC Legacy Android app to sync your profile, notices, payments, results and routine.</p><a class="btn primary" href="/download/android">Download the Android app</a></section>`;

  const dataViews = (d) => `
    <section class="card mt"><div class="row between"><div><b>${esc(d.name)}</b><p class="small muted">${esc(d.department)} · ${esc(d.session)} · ${esc(E.ordinal(d.year))} year</p></div><span class="xs muted">Synced ${new Date(d.syncedAt).toLocaleString()}</span></div>
      ${(d.warnings || []).map((w) => `<p class="xs" style="color:var(--warning-t)">${esc(w)}</p>`).join("")}</section>
    <section class="card mt stack"><b>Result transcript</b>
      ${d.exams.length ? `<label class="field">Exam<select class="input" id="es-exam">${d.exams.map((x) => `<option value="${esc(x.value)}" ${String(form.exam || d.exams[0].value) === x.value ? "selected" : ""}>${esc(x.label)}</option>`).join("")}</select></label>
        <button class="btn neutral block" id="es-tr">${icon("file")} Open transcript (PDF)</button>` : `<p class="small muted">No exams are listed for your class yet.</p>`}</section>
    <section class="card mt stack"><b>Class routine</b><p class="small muted">The college publishes it as a PDF for ${esc(d.department)}, ${esc(E.ordinal(d.year))} year.</p>
      <button class="btn neutral block" id="es-rt">${icon("calendar")} Open routine (PDF)</button></section>
    <section class="card mt stack"><b>Notices</b>${d.notices.length ? d.notices.slice(0, 20).map((n) => `<div class="stack" style="gap:2px"><b class="small">${esc(n.title)}</b><span class="xs muted">${esc(n.department)}${n.description ? " · " + esc(n.description) : ""}</span>
        ${(n.links || []).slice(0, 2).map((u, i) => `<a class="small" href="${esc(u)}" target="_blank" rel="noopener">Open attachment ${i + 1}</a>`).join(" ")}</div>`).join("<hr>") : `<p class="small muted">No notices right now.</p>`}</section>
    <section class="card mt stack"><b>Payments</b>${d.receipts.length ? d.receipts.map((r) => `<div class="row between small"><span>${esc(r.type)}<br><span class="xs muted">${esc(r.date)} · ${esc(r.bank)} · ${esc(r.trx)}</span></span><b>${yen(r.amount)}</b></div>`).join("<hr>") : `<p class="small muted">No payments found.</p>`}</section>
    <section class="card mt stack"><b>Your subjects</b>${d.subjects.length ? d.subjects.map((s) => `<div class="row between small"><span>${esc(s.name)}<br><span class="xs muted">${esc(s.first.code)}${s.second ? " / " + esc(s.second.code) : ""}</span></span><span class="xs muted">${esc(s.type)}</span></div>`).join("<hr>") : `<p class="small muted">No subjects listed.</p>`}</section>`;

  pages.sync = () => `${ctx.subHead("College portal", "Unofficial · not affiliated with Dhaka College", "#/more")}<div style="max-width:680px;margin:0 auto">
    <h1 style="font-size:28px">Your <span class="hl">Dhaka College</span> data</h1>
    <p class="muted small">Profile, notices, payments, results and routine from the college eShiksa portal, in one place.</p>
    ${can() ? formCard() : noNative()}${S().eshiksa ? dataViews(S().eshiksa) : ""}</div>`;

  const ensure = async () => { // the portal session lives in the hidden browser; sign in again if it ended
    try { if ((await bridge().exec({ script: "document.getElementById('departmentList') ? 'yes' : 'no'" })).result === "yes") return; } catch { /* closed */ }
    if (!saved.saved) throw new Error("Your portal session ended. Sync again.");
    await E.signIn(bridge(), { useSaved: true }); await E.openDashboard(bridge());
  };
  const openPdf = async (btn, label, get, name) => {
    if (busy) return; busy = true; btn.disabled = true; const t = btn.innerHTML; btn.textContent = "Opening…";
    try { await ensure(); await bridge().openPdf({ base64: (await get()).b64, name }); }
    catch (e) { toast(label, "error", e.message || String(e)); }
    busy = false; btn.disabled = false; btn.innerHTML = t;
  };
  const applyProfile = (d) => {
    const p = S().profile || {};
    S().profile = { ...p, name: d.name, id: d.roll, program: d.department, department: d.department, semester: `${E.ordinal(d.year)} year`, source: "eshiksa",
      advisor: p.advisor || "", advisorInitial: p.advisorInitial || "", email: p.email || "", creditsDone: p.creditsDone ?? 0, creditsTotal: p.creditsTotal ?? 0, cgpa: p.cgpa ?? 0 };
  };
  async function doSync() {
    if (busy) return;
    const roll = form.roll.trim() || S().eshiksa?.roll || "", useSaved = !form.pw && saved.saved;
    if (!/^\d{6,20}$/.test(roll)) { run = { error: "Enter your class roll (numbers only)." }; return repaint(); }
    if (!form.pw && !useSaved) { run = { error: "Enter the portal password." }; return repaint(); }
    busy = true; run = { steps: [], error: "" }; repaint();
    try {
      const d = await E.syncAll(bridge(), { roll, password: form.pw, useSaved, onStep: (s) => { run.steps.push(s); repaint(); } });
      if (form.remember && form.pw) { await bridge().rememberLogin({ username: E.LOGIN_USER, password: form.pw }).catch(() => {}); saved = { saved: true }; }
      form.pw = ""; S().eshiksa = d; applyProfile(d); ctx.save(); run = null;
      toast("Synced", "success", `${d.notices.length} notices, ${d.receipts.length} payments`);
    } catch (e) { run = { steps: run?.steps || [], error: e.message || String(e) }; }
    busy = false; repaint();
  }
  pages.sync.mount = (el) => {
    if (can() && !savedAsked) { savedAsked = true; bridge().savedLogin().then((s) => { if (s.saved !== saved.saved) { saved = s; repaint(); } }).catch(() => {}); }
    $("#es-roll", el)?.addEventListener("input", (e) => { form.roll = e.target.value.replace(/\D/g, ""); });
    $("#es-pw", el)?.addEventListener("input", (e) => { form.pw = e.target.value; });
    $("#es-rem", el)?.addEventListener("change", (e) => { form.remember = e.target.checked; });
    $("#es-exam", el)?.addEventListener("change", (e) => { form.exam = e.target.value; });
    $("#es-go", el)?.addEventListener("click", doSync);
    $("#es-forget", el)?.addEventListener("click", async () => { await bridge().forgetLogin().catch(() => {}); saved = { saved: false }; repaint(); });
    $("#es-tr", el)?.addEventListener("click", (e) => { const d = S().eshiksa; openPdf(e.currentTarget, "Transcript", () => E.fetchTranscript(bridge(), { roll: d.roll, examId: form.exam || d.exams[0].value }), "transcript"); });
    $("#es-rt", el)?.addEventListener("click", (e) => { const d = S().eshiksa; openPdf(e.currentTarget, "Routine", () => E.fetchRoutine(bridge(), { sessionId: d.sessionId, deptId: d.deptId, year: d.year }), "routine"); });
  };
  return { takeExtHandoff() {}, checkInbox: async () => false, openSync: () => ctx.go("#/sync") };
}
