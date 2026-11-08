// Old notice-board parser (to be replaced by the eShiksa notice sync).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseNotices, categoryOf } from "../src/notices.js";

test("Dhaka College notice board page → notices with dates, links and categories", () => {
  const n = parseNotices(readFileSync(new URL("./fixtures/ewu-notice-board.html", import.meta.url), "utf8"));
  assert.ok(n.length >= 10, `${n.length} notices`);
  assert.ok(n.every((x) => x.title && x.url.startsWith("https://www.ewubd.edu/notice-details/") && /^\d{4}-\d\d-\d\d$/.test(x.date)));
  assert.equal(new Set(n.map((x) => x.id)).size, n.length);
  assert.ok(n.some((x) => x.pdf.endsWith(".pdf")));
});

test("notice categories", () => {
  assert.equal(categoryOf("Schedule of Pre-advising for Spring 2027"), "Advising");
  assert.equal(categoryOf("Final Examination Schedule"), "Exams");
  assert.equal(categoryOf("MERIT SCHOLARSHIP: Fall Semester 2026"), "Scholarships");
  assert.equal(categoryOf("Collection of RFID Card"), "General");
});

