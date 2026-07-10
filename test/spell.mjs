// Golden tests for the rule-based speller. These words are NOT looked up in
// the dictionary: every one is built from Khmer orthography rules, so a change
// that breaks a rule shows up here.
//
// `spell-eval.mjs` prints overall accuracy; this file pins the behaviour.

import { spell } from "../src/spell.js";

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `   ${detail}`}`);
}

// The rules must put these first. Each one exercises a specific rule.
const first = {
  pteah: "ផ្ទះ", // subscript cluster + o-series ះ from the coeng
  pteas: "ផ្ទះ", // final "s" written as ះ
  preah: "ព្រះ", // p stays ព before r
  chhma: "ឆ្មា", // aspirated cluster head
  nis: "នេះ", // "is" fuses to េះ
  os: "អស់", // vowel-less onset takes អ, real final ស់
  nas: "ណាស់", // "a" forces the a-series ណ
  srolanh: "ស្រឡាញ់", // ស្រ keeps a-series, so "a" reaches ឡា
  kampong: "កំពង់", // mp is no onset, so it splits kam-pong
  akrok: "អាក្រក់", // kr IS an onset, so it splits a-krok
  dak: "ដាក់", // ់ shortens ា
  chenh: "ចេញ", // no ់ after េ
  sdap: "ស្ដាប់",
  kbal: "ក្បាល",
  mien: "មាន",
  lean: "លាន",
  srey: "ស្រី",
  trey: "ត្រី",
  pel: "ពេល",
  dai: "ដៃ",
  chas: "ចាស់",
};

for (const [rom, khmer] of Object.entries(first)) {
  const got = spell(rom, 3);
  check(`${rom} -> ${khmer}`, got[0] === khmer, `got ${got.join(" ") || "(none)"}`);
}

// Genuinely ambiguous: the right spelling must be offered, but need not lead.
// This is exactly the case the chips exist for.
const offered = {
  khmer: "ខ្មែរ",
  der: "ដែរ",
  bay: "បាយ",
  bat: "បាទ",
  kru: "គ្រូ",
  sach: "សាច់",
  dol: "ដល់",
  mok: "មក",
};

for (const [rom, khmer] of Object.entries(offered)) {
  const got = spell(rom, 3);
  check(`${rom} offers ${khmer}`, got.includes(khmer), `got ${got.join(" ") || "(none)"}`);
}

// The bantoc marks the last syllable, so it must not appear mid-word.
check(
  "no mid-word ់ in kampong",
  spell("kampong", 1)[0].indexOf("់") === spell("kampong", 1)[0].length - 1,
  spell("kampong", 1)[0]
);

// Candidates are distinct and capped.
const cands = spell("pteah", 3);
check("candidates are deduped", new Set(cands).size === cands.length, cands.join(" "));
check("respects the limit", spell("pteah", 2).length <= 2);

// Words with no syllable to spell yield nothing, and the caller falls back.
check("vowel-less word yields nothing", spell("xyz").length === 0);
check("empty input yields nothing", spell("").length === 0);
check("digits yield nothing", spell("123").length === 0);

console.log(failed ? `${failed} test(s) failed` : "All speller tests passed");
process.exit(failed ? 1 : 0);
