// Khmer slang conversion engine.
// convert(input, dict) -> { text, tokens }
// tokens: [{ text, type }] with type in "match" | "guess" | "unknown" | "sep"
//
// Pipeline (per the build spec):
// 1. Longest-phrase dictionary match, up to 4 words.
// 2. Glued-prefix peeling: otniyeay -> ot + niyeay (prefix must itself be in the dictionary).
// 3. Spell the word from Khmer orthography rules, marked low confidence.
// 4. Adjacent Khmer words join with no space.

import { spell } from "./spell.js";

const MAX_PHRASE = 4;

// Longest first so "mish..." is not eaten by "mi".
const PEEL_PREFIXES = ["mish", "kom", "min", "nov", "hx", "ot", "jg", "nv"];

const DIGRAPHS = [
  ["khm", "ខ្ម"],
  ["chh", "ឆ"],
  ["kh", "ខ"],
  ["ch", "ច"],
  ["th", "ថ"],
  ["ph", "ផ"],
  ["ng", "ង"],
  ["nh", "ញ"],
  ["sr", "ស្រ"],
  ["kr", "ក្រ"],
  ["pr", "ព្រ"],
  ["tr", "ត្រ"],
  ["kl", "ក្ល"],
  ["pl", "ផ្ល"],
  ["aa", "ា"],
  ["ae", "ែ"],
  ["ai", "ៃ"],
  ["ao", "ោ"],
  ["au", "ៅ"],
  ["ea", "ា"],
  ["ei", "ី"],
  ["eu", "ឺ"],
  ["ie", "ៀ"],
  ["ou", "ូ"],
  ["oo", "ូ"],
];

const LETTERS = {
  a: "ា", b: "ប", c: "ច", d: "ដ", e: "េ", f: "ហ្វ", g: "គ", h: "ហ",
  i: "ិ", j: "ជ", k: "ក", l: "ល", m: "ម", n: "ន", o: "ោ", p: "ព",
  q: "ក", r: "រ", s: "ស", t: "ត", u: "ុ", v: "វ", w: "វ", x: "ស",
  y: "យ", z: "ហ្ស",
};

// Dependent vowel signs cannot start a syllable; give them an អ base.
const VOWEL_SIGNS = new Set(["ា", "េ", "ែ", "ៃ", "ោ", "ៅ", "ី", "ិ", "ឺ", "ុ", "ូ", "ៀ"]);

function lookup(word, dict) {
  return dict[word.toLowerCase()];
}

function peel(word, dict, depth = 0) {
  if (depth > 3) return null;
  const lower = word.toLowerCase();
  for (const prefix of PEEL_PREFIXES) {
    if (!lower.startsWith(prefix) || lower.length <= prefix.length) continue;
    const head = lookup(prefix, dict);
    if (!head) continue;
    const restWord = lower.slice(prefix.length);
    const rest = lookup(restWord, dict);
    if (rest) return head + rest;
    const deeper = peel(restWord, dict, depth + 1);
    if (deeper) return head + deeper;
  }
  return null;
}

export function guess(word) {
  const lower = word.toLowerCase();
  let out = "";
  let i = 0;
  while (i < lower.length) {
    let hit = null;
    for (const [rom, kh] of DIGRAPHS) {
      if (lower.startsWith(rom, i)) {
        hit = [rom, kh];
        break;
      }
    }
    let kh;
    if (hit) {
      kh = hit[1];
      i += hit[0].length;
    } else {
      kh = LETTERS[lower[i]];
      if (kh === undefined) kh = lower[i];
      i += 1;
    }
    if (out === "" && VOWEL_SIGNS.has(kh)) out += "អ";
    out += kh;
  }
  return out;
}

function push(tokens, tok) {
  const prev = tokens[tokens.length - 1];
  if (prev && prev.type !== "sep" && (prev.type === "unknown" || tok.type === "unknown")) {
    tokens.push({ text: " ", type: "sep" });
  }
  tokens.push(tok);
}

export function convert(input, dict) {
  const tokens = [];
  if (!input || !input.trim()) return { text: "", tokens };

  const parts = input.trim().split(/\s+/);
  let i = 0;
  while (i < parts.length) {
    // 1. Longest phrase first.
    let matched = false;
    const maxLen = Math.min(MAX_PHRASE, parts.length - i);
    for (let len = maxLen; len >= 1; len--) {
      const key = parts.slice(i, i + len).join(" ").toLowerCase();
      const hit = dict[key];
      if (hit) {
        push(tokens, { text: hit, type: "match" });
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const word = parts[i];
    i += 1;

    // Non-alphabetic content (numbers, emoji, punctuation) passes through.
    if (!/^[a-z']+$/i.test(word)) {
      push(tokens, { text: word, type: "unknown" });
      continue;
    }

    // 2. Glued-prefix peeling.
    const peeled = peel(word, dict);
    if (peeled) {
      push(tokens, { text: peeled, type: "match" });
      continue;
    }

    // 3. Spell it from the rules, falling back to the letter map.
    push(tokens, { text: spell(word, 1)[0] || guess(word), type: "guess" });
  }

  return { text: tokens.map((t) => t.text).join(""), tokens };
}
