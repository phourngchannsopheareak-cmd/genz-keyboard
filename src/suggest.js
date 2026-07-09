// Suggestion engine for the strip above the keyboard.
// suggest(context, dict, learned) -> up to `limit` candidates:
//   [{ key, khmer, type, replaceWords }] with type "match" | "guess"
//
// `context` is the tail of the typing buffer (up to the last 3 words, no
// trailing space). Phrase entries are matched against multi-word tails, so
// typing "kampong ch" offers កំពង់ឆ្នាំង and accepting it replaces both words.
//
// Ranking, highest first:
// 1. The exact Khmer the user picked for this same typed string before (learned.picks).
// 2. Multi-word tail matches (the user is clearly mid-phrase).
// 3. Exact dictionary hits over prefix hits.
// 4. Words the user accepts often (learned.words counts).
// 5. Built-in commonness prior, so day-one defaults feel right.
// 6. Shorter romanizations (closer to what was typed).
// Candidates that map to the same Khmer word are shown only once.

import { guess } from "./converter.js";

// Prior weights for very common words, used before any learning exists.
const FREQ = {
  "ខ្ញុំ": 9, "ទៅ": 9, "នៅ": 8, "អត់": 8, "ចង់": 8, "ហើយ": 8,
  "ទេ": 8, "បាន": 7, "មាន": 7, "អី": 7, "បង": 7, "អូន": 7,
  "ញ៉ាំ": 7, "ស្រឡាញ់": 7, "គេ": 6, "យើង": 6, "មក": 6, "ដឹង": 6,
  "ណាស់": 6, "នេះ": 6, "ផ្ទះ": 5, "នឹក": 5, "ចាំ": 5, "ម៉ែ": 5,
  "ប៉ា": 5, "កុំ": 5, "មិន": 5, "ជា": 4, "ណា": 4, "ដែរ": 4,
  "ម៉េច": 6, "ហ្នឹង": 6, "មើល": 5, "អូខេ": 5, "ចូលចិត្ត": 5,
  "ដាក់": 4, "ស្ដាប់": 4,
};

export function suggest(context, dict, learned, limit = 3) {
  const ctx = (context || "").toLowerCase().trim();
  if (!ctx || !/^[a-z']+( [a-z']+)*$/.test(ctx)) return [];

  const picks = (learned && learned.picks) || {};
  const counts = (learned && learned.words) || {};
  const words = ctx.split(" ");
  const maxN = Math.min(3, words.length);

  const best = new Map(); // khmer -> candidate
  for (let n = 1; n <= maxN; n++) {
    const tail = words.slice(-n).join(" ");
    for (const [key, khmer] of Object.entries(dict)) {
      if (key !== tail && !key.startsWith(tail)) continue;

      let score = 0;
      if (picks[tail] === khmer) score += 1000;
      if (key === tail) score += 500;
      score += (n - 1) * 600;
      score += (counts[khmer] || 0) * 40;
      score += (FREQ[khmer] || 0) * 10;
      score += Math.max(0, 20 - key.length);

      const prev = best.get(khmer);
      if (!prev || score > prev.score) {
        best.set(khmer, { key, khmer, score, type: "match", replaceWords: n });
      }
    }
  }

  const out = [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ key, khmer, type, replaceWords }) => ({ key, khmer, type, replaceWords }));

  // Nothing in the dictionary: offer the letter-by-letter guess as a chip.
  if (out.length === 0) {
    const last = words[words.length - 1];
    return [{ key: last, khmer: guess(last), type: "guess", replaceWords: 1 }];
  }
  return out;
}
