// eShiksa sync: parsers and driver. The HTML below is SYNTHETIC, rebuilt from screenshots of the portal's pages (no real
// student data); check the parsers against the portal's real responses before trusting them.
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import * as E from "../src/eshiksa.js";

const PROFILE = `<div id="stdInfo"><h4>Student Info</h4><table><tr><td>Name :</td><td>TEST STUDENT</td></tr><tr><td>Department :</td><td>HSC - Science</td></tr>
  <tr><td>Session :</td><td>2023-2024</td></tr><tr><td>Academic Year :</td><td>2</td></tr></table><img src="photo.jpg">
  <table><tr><th>1st Paper</th><th>2nd Paper</th><th>Subject Type</th></tr>
  <tr><td>101 - Bangla 1st paper</td><td>102 - Bangla 2nd paper</td><td>Mandatory</td></tr>
  <tr><td>275 - ICT</td><td></td><td>Mandatory</td></tr>
  <tr><td>178 - Biology 1st paper</td><td>179 - Biology 2nd paper</td><td>Fourth</td></tr></table></div>`;
const RECEIPTS = `<table><tr><th>Student Name</th><th>Bank/MFS Name</th><th>Transaction No</th><th>Transaction Date</th><th>Fee Type</th><th>Amount</th><th>Print</th></tr>
  <tr><td>TEST STUDENT</td><td>bKash</td><td>AB12CD34</td><td>06-Mar-2025</td><td>Form fill-up</td><td>2,835</td><td><button>Print</button></td></tr>
  <tr><td>TEST STUDENT</td><td>nagad</td><td>ZZ99</td><td>11-Oct-2024</td><td>Promotion (stipend)</td><td>3,636</td><td><button>Print</button></td></tr></table>`;
const NOTICES = `<table><tr><td>Title</td><td>Notice For HSC (2025-2026) Students about CT-3</td></tr><tr><td>Description</td><td></td></tr><tr><td>Department</td><td>HSC - Science</td></tr>
  <tr><td>Content</td><td><img src="/uploads/notice1.jpg"><img src="data:image/png;base64,AAAA"></td></tr></table>
  <table><tr><td>Title</td><td>Test</td></tr><tr><td>Description</td><td>Test</td></tr><tr><td>Department</td><td>All Department</td></tr><tr><td>Content</td><td></td></tr></table>
  <table><tr><td>Title</td><td>Test</td></tr><tr><td>Department</td><td>All Department</td></tr></table>`;

test("profile: name, department, session, year and subject list (empty second paper kept)", () => {
  const p = E.parseProfile(PROFILE);
  assert.deepEqual([p.name, p.department, p.session, p.year], ["TEST STUDENT", "HSC - Science", "2023-2024", 2]);
  assert.equal(p.subjects.length, 3);
  assert.deepEqual(p.subjects[1], { type: "Mandatory", first: { code: "275", name: "ICT" }, second: null, name: "ICT" });
  assert.equal(p.subjects[0].name, "Bangla"); assert.equal(p.subjects[2].type, "Fourth");
  assert.equal(E.parseProfile("<p>Error: no student</p>"), null);
});
test("receipts: columns by header, amount and ISO date, no student name kept", () => {
  const r = E.parseReceipts(RECEIPTS);
  assert.deepEqual(r[0], { bank: "bKash", trx: "AB12CD34", date: "2025-03-06", type: "Form fill-up", amount: 2835 });
  assert.equal(r.length, 2); assert.ok(!JSON.stringify(r).includes("TEST STUDENT"));
});
test("notices: grouped by Title, links kept, inline data images dropped, duplicates merged", () => {
  const n = E.parseNotices(NOTICES);
  assert.equal(n.length, 2);
  assert.deepEqual(n[0].links, ["https://dhakacollege.eshiksabd.com/uploads/notice1.jpg"]);
  assert.equal(n[0].department, "HSC - Science"); assert.equal(n[1].title, "Test");
  const alt = E.parseNotices("<div>Title Holiday Description Eid break Department All Department Content see below</div>");
  assert.equal(alt[0].title, "Holiday"); assert.equal(alt[0].description, "Eid break");
});
test("options, name matching and errors", () => {
  assert.deepEqual(E.parseOptions("<option value=\"7\">Class Test 2 (HSC)<option selected value=\"8\">Term</option>"), [{ value: "7", label: "Class Test 2 (HSC)" }, { value: "8", label: "Term" }]);
  assert.deepEqual(E.pick([["4", "HSC - Science"]], "HSC-Science"), ["4", "HSC - Science"]);
  assert.ok(E.isError("Error: not allowed") && E.isError("  ") && !E.isError("<tr><td>ok</td></tr>"));
});
test("page scripts are valid JavaScript", () => {
  for (const s of [E.scripts.lists, E.scripts.posts([["a", { rootData: "1" }]]), E.scripts.pdf("x.php?a=1&b=2")]) assert.doesNotThrow(() => new vm.Script(s));
});

const fake = (over = {}) => {
  const calls = [];
  const b = { calls,
    open: async () => ({ login: true }), login: async (a) => { calls.push(["login", a.username, !!a.password]); return { login: false }; },
    read: async () => ({ result: JSON.stringify({ dept: [["0", "All Department"], ["4", "HSC - Science"]], sess: [["19", "2023-2024"]] }) }),
    exec: async ({ script }) => {
      const m = [...script.matchAll(/\[\["([A-Za-z]+)"/g)].map((x) => x[1])[0] || "";
      const out = over[m] ?? ({ profileRollCheck: [PROFILE], transactionCheck: [RECEIPTS, NOTICES, NOTICES, "<option value=\"0\">Select</option><option value=\"31\">Class Test 2</option>"] }[m]);
      calls.push(["exec", m]); return { result: JSON.stringify(out ? { ok: true, out } : { ok: true, b64: "JVBERi0=" }) };
    } };
  return b;
};
test("syncAll: signs in with the shared user id, reads profile, notices, receipts and exams", async () => {
  const b = fake(), steps = [];
  const d = await E.syncAll(b, { roll: "1202324010182", password: "pw", onStep: (s) => steps.push(s) });
  assert.deepEqual(b.calls[0], ["login", "dcstudent", true]);
  assert.deepEqual(steps, E.STEPS);
  assert.equal(d.name, "TEST STUDENT"); assert.equal(d.deptId, "4"); assert.equal(d.sessionId, "19"); assert.equal(d.year, 2);
  assert.equal(d.notices.length, 2); assert.equal(d.receipts.length, 2); assert.deepEqual(d.exams, [{ value: "31", label: "Class Test 2" }]);
  assert.ok(!JSON.stringify(d).includes("photo.jpg"));
});
test("syncAll: bad roll, wrong password, unknown student", async () => {
  await assert.rejects(E.syncAll(fake(), { roll: "12ab" }), /class roll/);
  await assert.rejects(E.syncAll({ ...fake(), login: async () => ({ login: true, error: "" }) }, { roll: "1202324010182", password: "x" }), /password/);
  await assert.rejects(E.syncAll(fake({ profileRollCheck: ["Error: no data"] }), { roll: "1202324010182", password: "x" }), /No student/);
});
test("transcript and routine: blocked, missing and ok", async () => {
  await assert.rejects(E.fetchTranscript(fake({ checkTranscriptPermission: ["Error: Result is blocked"] }), { roll: "1", examId: "31" }), /blocked/);
  const ok = await E.fetchTranscript(fake({ checkTranscriptPermission: ["ok"], checkStudentTranscript: ["https://dhakacollege.eshiksabd.com/t.pdf"] }), { roll: "1", examId: "31" });
  assert.equal(ok.b64, "JVBERi0=");
  const none = fake({ ajaxEncryption: ["abc", "def"] }); none.exec = async ({ script }) => ({ result: JSON.stringify(/NOPDF/.test(script) ? { ok: false, error: "NOPDF" } : { ok: true, out: ["abc", "def"] }) });
  await assert.rejects(E.fetchRoutine(none, { sessionId: "19", deptId: "4", year: 2 }), /isn't published/);
  await assert.rejects(E.fetchRoutine(fake(), { sessionId: "", deptId: "", year: 1 }), /Sync again/);
});
