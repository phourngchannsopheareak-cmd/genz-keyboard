// Guards against the JS and Swift spellers drifting apart.
//
// src/spell.js and ios/Keyboard/Speller.swift hold the same tables written
// twice. Nothing stops someone fixing a rule in one and forgetting the other,
// and the bug would only ever show up on a phone. So: read the table section
// of both files and compare the Khmer letters and the numeric weights, in
// order. The two files are deliberately kept in the same declaration order to
// make this possible.
//
// This checks the tables, not the algorithm. A change to the scoring code
// still has to be mirrored by hand.

import { readFileSync } from "node:fs";

const js = readFileSync(new URL("../src/spell.js", import.meta.url), "utf8");
const swift = readFileSync(new URL("../ios/Keyboard/Speller.swift", import.meta.url), "utf8");

// The tables run from the coeng constant down to the derived key list.
function tableBlock(text, start, end) {
  const a = text.indexOf(start);
  const b = text.indexOf(end);
  if (a < 0 || b < 0 || b <= a) {
    throw new Error(`could not locate table block between "${start}" and "${end}"`);
  }
  return text.slice(a, b);
}

// Comments explain the rules in prose, quote example words in Khmer, and
// legitimately differ between the two files. Strip them before comparing.
// (No string literal in either table block contains "//".)
function stripComments(text) {
  return text.replace(/\/\/.*$/gm, "");
}

const KHMER = /[ក-៿]+/g;
const NUMBER = /-?\d+(?:\.\d+)?/g;

const jsBlock = stripComments(tableBlock(js, 'const COENG', 'const CONS_KEYS'));
const swiftBlock = stripComments(
  tableBlock(swift, 'private static let coeng', 'private static let consKeys')
);

let failed = 0;
function compare(label, a, b) {
  const same = a.length === b.length && a.every((v, i) => v === b[i]);
  if (!same) {
    failed++;
    console.log(`FAIL  ${label} differ between spell.js and Speller.swift`);
    const n = Math.max(a.length, b.length);
    let shown = 0;
    for (let i = 0; i < n && shown < 6; i++) {
      if (a[i] !== b[i]) {
        console.log(`        #${i}  js=${a[i] ?? "(end)"}  swift=${b[i] ?? "(end)"}`);
        shown++;
      }
    }
    console.log(`        js has ${a.length}, swift has ${b.length}`);
  } else {
    console.log(`PASS  ${label} match (${a.length} entries)`);
  }
}

compare(
  "Khmer letters in the tables",
  jsBlock.match(KHMER) || [],
  swiftBlock.match(KHMER) || []
);

compare(
  "weights and biases",
  (jsBlock.match(NUMBER) || []).map(Number).map(String),
  (swiftBlock.match(NUMBER) || []).map(Number).map(String)
);

// The scoring constants live in the algorithm, not the tables, so pin the ones
// that decide ranking.
const constants = [
  ["absorption bonus", /bonus: (0\.\d+) \}\);/, /bonus: (0\.\d+)\)\)/],
  ["subscript penalty", /score: partial\.score \+ opt\.score - (0\.\d+),/, /partial\.score \+ opt\.score - (0\.\d+)\)\)/],
  ["relax penalty", /relax \? (\d\.\d+) : 0/, /relax \? (\d\.\d+) : 0/],
  ["vowel rank step", /vi \* (0\.\d+)/, /Double\(vi\) \* (0\.\d+)/],
  ["mid-word bantoc penalty", /isLast \? 0 : (\d\.\d+)/, /isLast \? 0 : (\d\.\d+)/],
];

for (const [label, jsRe, swiftRe] of constants) {
  const a = js.match(jsRe);
  const b = swift.match(swiftRe);
  if (!a || !b) {
    failed++;
    console.log(`FAIL  ${label}: not found in ${!a ? "spell.js" : "Speller.swift"}`);
    continue;
  }
  compare(`${label} (${a[1]})`, [a[1]], [b[1]]);
}

console.log(failed ? `${failed} parity check(s) failed` : "JS and Swift spellers are in sync");
process.exit(failed ? 1 : 0);
