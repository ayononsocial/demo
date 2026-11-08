// News parser (saved public news page) and the alumni dataset's integrity.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseNews, tagOf } from "../src/news.js";

test("Dhaka College news page → articles with image, date, excerpt and link", () => {
  const n = parseNews(readFileSync(new URL("./fixtures/ewu-news.html", import.meta.url), "utf8"));
  assert.ok(n.length >= 10, `${n.length} articles`);
  assert.ok(n.every((x) => x.title && x.url.startsWith("https://www.ewubd.edu/news/") && /^\d{4}-\d\d-\d\d$/.test(x.date)));
  assert.ok(n.filter((x) => x.image.startsWith("https://")).length >= n.length - 2);
  assert.equal(new Set(n.map((x) => x.id)).size, n.length);
});

test("news tags", () => {
  assert.equal(tagOf("EWUCRT Holds 146th Research Seminar"), "Research");
  assert.equal(tagOf("Dhaka College and Huawei Technologies Partner to Boost ICT Education"), "Partnership");
  assert.equal(tagOf("Dhaka College Observes World Teachers' Day 2026"), "Events");
});

