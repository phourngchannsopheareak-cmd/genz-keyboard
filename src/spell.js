// Rule-based Khmer speller.
//
// The dictionary can only type words someone already added. This spells ANY
// romanized word from Khmer orthography rules, so `pteah` -> ផ្ទះ even if it
// was never in dictionary.json.
//
// spell(word, limit) -> [khmer, ...] best first.
//
// Why more than one answer: Khmer writes each consonant sound twice, once in
// the a-series and once in the o-series (t = ត or ទ, ch = ច or ជ). Romanized
// text throws that distinction away, so the rules genuinely cannot know which
// one was meant. We return the 2-3 most likely spellings and let the user tap
// the right one. Their pick is saved, so the dictionary grows by itself.
//
// A syllable is [onset consonants][vowel][coda consonant].
//   pteah -> onset "pt", vowel "ea", coda "h"  -> ផ្ទះ
// The onset's first consonant is a full letter; the rest hang below it as
// subscripts (coeng, ជើង = "្" + letter).

const COENG = "្"; // ្  combining subscript marker
const BANTOC = "់"; // ់  shortens the vowel

// ---------------------------------------------------------------------------
// Consonants. rom -> [khmer, series, weight]. Higher weight = more likely.
// Series drives how the following vowel sign is read.
// ---------------------------------------------------------------------------
const CONS = {
  chh: [["ឆ", "a", 3], ["ឈ", "o", 1]],
  kh: [["ខ", "a", 3], ["ឃ", "o", 1]],
  ch: [["ច", "a", 3], ["ជ", "o", 2], ["ឆ", "a", 1]],
  ny: [["ញ", "o", 3]],
  th: [["ថ", "a", 3], ["ធ", "o", 1]],
  ph: [["ផ", "a", 3], ["ភ", "o", 1]],
  ng: [["ង", "o", 3]],
  nh: [["ញ", "o", 3]],
  k: [["ក", "a", 3], ["គ", "o", 2]],
  g: [["គ", "o", 3]],
  j: [["ជ", "o", 3], ["ច", "a", 1]],
  d: [["ដ", "a", 3], ["ឌ", "o", 1]],
  t: [["ត", "a", 3], ["ទ", "o", 2]],
  n: [["ន", "o", 3], ["ណ", "a", 1]],
  b: [["ប", "a", 3]],
  p: [["ព", "o", 3], ["ប", "a", 2], ["ផ", "a", 1]],
  m: [["ម", "o", 3]],
  y: [["យ", "o", 3]],
  r: [["រ", "o", 3]],
  l: [["ល", "o", 3], ["ឡ", "a", 1]],
  v: [["វ", "o", 3]],
  w: [["វ", "o", 3]],
  s: [["ស", "a", 3]],
  h: [["ហ", "a", 3]],
  f: [["ហ្វ", "a", 3]],
  z: [["ហ្ស", "a", 3]],
  q: [["ក", "a", 1]],
  x: [["ស", "a", 1]],
  c: [["ក", "a", 1]],
};

// These sonorants keep the FIRST consonant's a-series when they sit below it.
// ស្រ stays a-series (srei = ស្រី), but ផ្ទ flips to o-series (pteah = ផ្ទះ).
const SONORANT = new Set(["ង", "ញ", "ន", "ម", "យ", "រ", "ល", "វ"]);

// ---------------------------------------------------------------------------
// Vowels. rom -> { a: [signs], o: [signs] }.
// The SAME sign sounds different per series, so each romanization is only
// reachable from the series that actually produces that sound. This is what
// prunes the candidate list down to something tappable.
// "" is the inherent vowel (no sign written).
// ---------------------------------------------------------------------------
const VOWEL = {
  "": { a: [""], o: [""] },
  // No o-series sign sounds like plain "a": ា reads "ea" and the inherent
  // vowel reads "ɔɔ". So an "a" forces the a-series letter, which is exactly
  // how srolanh reaches ស្រឡាញ់ (ឡ) and nas reaches ណាស់ (ណ).
  a: { a: ["ា", ""], o: [] },
  aa: { a: ["ា"], o: [] },
  ea: { a: [], o: ["ា"] },
  e: { a: ["េ", "ែ", "ិ", "ឹ"], o: ["េ", "ិ", "ឹ"] },
  ee: { a: [], o: ["ី", "េ"] },
  i: { a: ["ិ"], o: ["ិ", "ី"] },
  ii: { a: [], o: ["ី"] },
  ei: { a: ["ី"], o: [] },
  ey: { a: ["ី"], o: ["ៃ"] },
  oe: { a: ["ឹ"], o: [] },
  eu: { a: ["ឺ", "ើ"], o: ["ើ", "ឺ", "ឹ"] },
  // Both inherent vowels already sound like "o" (bong = បង, pong = ពង់),
  // but the long one is written ូ (kon = កូន, toch = តូច).
  o: { a: ["", "ុ", "ូ"], o: ["", "ុ", "ូ", "ោ"] },
  oa: { a: [], o: ["ា"] },
  or: { a: ["ោ", ""], o: ["ូ", ""] },
  er: { a: ["ើ"], o: ["ើ"] },
  eur: { a: ["ើ"], o: ["ើ"] },
  ur: { a: ["ូ"], o: ["ូ"] },
  // An o-series inherent vowel closed by ់ reads "u" (yub = យប់).
  u: { a: ["ុ"], o: ["ុ", "ូ", ""] },
  uu: { a: [], o: ["ូ"] },
  ue: { a: ["ួ"], o: ["ួ"] },
  oue: { a: ["ួ"], o: ["ួ"] },
  ou: { a: ["ូ", "ួ"], o: ["ៅ", "ូ"] },
  oo: { a: [], o: ["ូ", "ោ"] },
  uo: { a: ["ួ"], o: ["ួ"] },
  ua: { a: ["ួ"], o: ["ួ"] },
  ae: { a: ["ែ", "ើ"], o: ["ែ"] },
  aeu: { a: ["ើ"], o: [] },
  oea: { a: ["ឿ"], o: ["ឿ"] },
  ie: { a: ["ៀ"], o: ["ា", "ៀ"] },
  ia: { a: ["ៀ"], o: ["ា", "ៀ"] },
  ai: { a: ["ៃ"], o: [] },
  ay: { a: ["ៃ"], o: [] },
  ao: { a: ["ោ"], o: [] },
  au: { a: ["ៅ", "ោ"], o: [] },
  aw: { a: ["ៅ"], o: [] },
  ov: { a: [], o: ["ៅ"] },
  oy: { a: ["ូ"], o: [] },
};

// Vowel + final m/h fuse into one written unit instead of a separate letter.
const FUSED = {
  am: { a: ["ំ", "ាំ"], o: ["ាំ"] },
  aam: { a: ["ាំ"], o: [] },
  oam: { a: [], o: ["ាំ"] },
  eam: { a: [], o: ["ាំ"] },
  om: { a: ["ុំ"], o: ["ំ", "ុំ"] },
  um: { a: [], o: ["ុំ", "ំ"] },
  im: { a: ["ិម"], o: ["ិម"] },
  ah: { a: ["ះ"], o: [] },
  eah: { a: [], o: ["ះ"] },
  oh: { a: ["ុះ"], o: [] },
  uh: { a: [], o: ["ុះ", "ោះ"] },
  eh: { a: ["េះ"], o: [] },
  ih: { a: [], o: ["េះ"] },
  aoh: { a: ["ោះ"], o: [] },
  oih: { a: ["ោះ"], o: [] },
};

// Khmerlish often writes the ះ ending with a final "s" instead of "h":
// pteas = ផ្ទះ, nis = នេះ. But a real final ស exists too, so these are offered
// alongside the plain-coda spelling, not instead of it. `as` and `os` get a
// weak bonus because they are usually a true ស់ (nas = ណាស់, os = អស់);
// the others are almost always ះ.
const FUSED_S = {
  as: { a: ["ះ"], o: [], bonus: 0.2 },
  eas: { a: [], o: ["ះ"], bonus: 1.6 },
  is: { a: ["េះ"], o: ["េះ"], bonus: 1.6 },
  es: { a: ["េះ"], o: ["េះ"], bonus: 1.2 },
  os: { a: ["ុះ"], o: [], bonus: 0.2 },
  us: { a: [], o: ["ុះ"], bonus: 1.2 },
  ous: { a: ["ោះ"], o: ["ោះ"], bonus: 1.4 },
  oas: { a: ["ោះ"], o: ["ោះ"], bonus: 1.4 },
};

// A `p` or `ch` heading a cluster is the aspirated letter (pteah = ផ្ទះ,
// plov = ផ្លូវ, chhma = ឆ្មា, chlat = ឆ្លាត), except before `r`, where the
// plain letter stays (preah = ព្រះ, chraen = ច្រើន).
function clusterBase(unit, nextUnit) {
  if (nextUnit === "r") return null;
  if (unit === "p") return { "ផ": 2.5 };
  if (unit === "ch") return { "ឆ": 2.5 };
  return null;
}

// Word-final "am" is written ាំ (chnam = ឆ្នាំ); inside a word it is ំ
// (kampong = កំពង់).
const FUSED_LAST = { am: { a: ["ាំ", "ំ"], o: ["ាំ"] } };

// Coda consonants written after the vowel. Like onsets, a final sound can be
// spelled with either series' letter (bat = បាទ, but dak = ដាក់).
const CODA = {
  ng: [["ង", 3]],
  nh: [["ញ", 3]],
  ch: [["ច", 3]],
  kh: [["ខ", 3]],
  th: [["ថ", 3]],
  ph: [["ប", 3]],
  k: [["ក", 3], ["ខ", 2], ["គ", 1]],
  g: [["ង", 2], ["ក", 2]],
  n: [["ន", 3], ["ណ", 1]],
  m: [["ម", 3]],
  y: [["យ", 3]],
  l: [["ល", 3]],
  s: [["ស", 3]],
  t: [["ត", 3], ["ទ", 2]],
  d: [["ត", 2], ["ដ", 1]],
  p: [["ប", 3], ["ព", 1]],
  b: [["ប", 3]],
  r: [["រ", 3]],
  j: [["ច", 2]],
  c: [["ក", 2]],
  v: [["វ", 3]],
  w: [["វ", 3]],
  x: [["ស", 2]],
};

// ់ only ever shortens the inherent vowel or ា. It never follows ិ ី ុ េ …
const BANTOC_VOWELS = new Set(["", "ា"]);

// Given ់ is possible, how likely it actually appears, by coda letter.
// Tuned against the hand-checked dictionary words.
const BANTOC_BIAS = {
  ស: 1.0, ង: 0.8, ញ: 0.8, ក: 0.2, ប: 0.2, ត: 0.0,
  ច: 0.0, យ: -0.2, ន: -0.4, ម: -0.8, ល: -0.4, រ: -0.8, វ: -0.4,
};

const CONS_KEYS = Object.keys(CONS).sort((a, b) => b.length - a.length);
const VOWEL_CHARS = new Set(["a", "e", "i", "o", "u"]);

// ---------------------------------------------------------------------------
// Segmentation
// ---------------------------------------------------------------------------

// Split a consonant run into the roman consonant units it is made of
// ("chh" and "kh" before "c"/"h"), longest first.
function splitCons(run) {
  const out = [];
  let i = 0;
  while (i < run.length) {
    const hit = CONS_KEYS.find((k) => run.startsWith(k, i));
    if (!hit) return null;
    out.push(hit);
    i += hit.length;
  }
  return out;
}

// Break the word into alternating consonant / vowel runs.
function runs(word) {
  const out = [];
  let i = 0;
  while (i < word.length) {
    const isV = VOWEL_CHARS.has(word[i]);
    let j = i;
    while (j < word.length && VOWEL_CHARS.has(word[j]) === isV) j++;
    out.push({ kind: isV ? "v" : "c", text: word.slice(i, j) });
    i = j;
  }
  return out;
}

// Turn the runs into syllables. A medial consonant run splits between the
// coda of this syllable and the onset of the next: as much as can legally
// start a syllable goes to the next one, so `kampong` -> kam + pong and
// `akrok` -> a + krok.
export function syllabify(word) {
  const parts = runs(word.toLowerCase());
  if (!parts.length) return null;

  const sylls = [];
  let onset = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.kind === "c") {
      // A consonant run with no vowel after it: coda of the last syllable.
      if (i === parts.length - 1) {
        if (!sylls.length) return null;
        sylls[sylls.length - 1].coda = part.text;
        onset = "";
        continue;
      }
      onset = part.text;
      continue;
    }

    // part.kind === "v"
    const next = parts[i + 1];
    let coda = "";
    if (next && next.kind === "c" && i + 1 < parts.length - 1) {
      // Medial run: hand the next syllable the longest legal onset it can
      // take, and keep whatever is left as our coda. `kr` is a legal onset so
      // akrok splits a-krok; `mp` is not, so kampong splits kam-pong.
      const units = splitCons(next.text);
      if (!units) return null;
      let take = units.length;
      while (take > 1 && !isLegalOnset(units.slice(units.length - take))) take--;
      coda = units.slice(0, units.length - take).join("");
      parts[i + 1] = { kind: "c", text: units.slice(units.length - take).join("") };
    }

    sylls.push({ onset, vowel: part.text, coda });
    onset = "";
  }

  return sylls.length ? sylls : null;
}

// Clusters Khmer actually allows to start a syllable.
const LEGAL_ONSET_2 = new Set([
  "kr", "kl", "kn", "kh", "khl", "khn", "khm", "chr", "chn", "chm",
  "thn", "thm", "phn", "phl", "phs", "pt", "pd", "pn", "pl", "pr",
  "sd", "st", "sr", "sl", "sm", "sn", "sk", "sb", "sp", "sv",
  "tr", "dr", "br", "bl", "mr", "ml", "mn", "vr", "gn", "jr", "nh",
  "ng", "ch", "th", "ph", "chh", "kt", "tv", "dt",
]);

function isLegalOnset(units) {
  return LEGAL_ONSET_2.has(units.join(""));
}

// ---------------------------------------------------------------------------
// Spelling one syllable
// ---------------------------------------------------------------------------

// Every base consonant letter, used to tell whether a partial spelling ends on
// something a subscript can legally hang under.
const KH_CONS = new Set(
  Object.values(CONS).flat().map(([kh]) => kh).filter((kh) => kh.length === 1)
);

// Build the written onset and work out which series governs the vowel.
// `sub` writes the whole onset as subscripts, hanging under the previous
// syllable's final consonant (angkor -> អ + ង + ្គ + រ).
function onsetForms(romOnset, sub = false) {
  if (!romOnset) return sub ? [] : [{ text: "អ", series: "a", score: 0 }];
  const units = splitCons(romOnset);
  if (!units) return [];

  // Choose a realization for each consonant; keep the combinations small.
  // Scores are penalties (best option = 0) so that a longer spelling never
  // outranks a shorter one just by collecting more positive weight.
  let combos = [{ letters: [], score: 0 }];
  for (let u = 0; u < units.length; u++) {
    const unit = units[u];
    const options = CONS[unit];
    if (!options) return [];
    const heading = u === 0 && units.length > 1;
    const bonus = (heading && clusterBase(unit, units[1])) || {};
    const best = Math.max(...options.map(([kh, , w]) => w + (bonus[kh] || 0)));
    const next = [];
    for (const combo of combos) {
      for (const [kh, series, weight] of options) {
        const w = weight + (bonus[kh] || 0);
        next.push({
          letters: [...combo.letters, { kh, series }],
          score: combo.score + Math.log(w / best),
        });
      }
    }
    combos = next.sort((a, b) => b.score - a.score).slice(0, 6);
  }

  return combos.map(({ letters, score }) => {
    const base = letters[0];
    const text = sub
      ? letters.map((l) => COENG + l.kh).join("")
      : base.kh + letters.slice(1).map((l) => COENG + l.kh).join("");
    // Series rule: the last consonant governs, unless it is a sonorant sitting
    // under an a-series base, which keeps the base's a-series.
    const last = letters[letters.length - 1];
    let series = last.series;
    if (letters.length > 1 && SONORANT.has(last.kh) && base.series === "a") {
      series = "a";
    }
    return { text, series, score };
  });
}

// How the vowel and coda can be divided. `r`, `y` and `w` after a vowel may
// spell part of the vowel (ber -> បើ) or a real final consonant (bay -> បាយ),
// so both readings become candidates.
function vowelCodaSplits(rawVowel, rawCoda) {
  const units = rawCoda ? splitCons(rawCoda) : [];
  if (units === null) return null;

  const splits = [{ vowel: rawVowel, units, bonus: 0 }];
  let vowel = rawVowel;
  let rest = units;
  while (rest.length && VOWEL[vowel + rest[0]]) {
    vowel += rest[0];
    rest = rest.slice(1);
    splits.push({ vowel, units: rest, bonus: 0.15 });
  }
  return splits;
}

// Candidate spellings for one syllable, each with a score.
function spellSyllable(syl, sub = false, isLast = true) {
  const onsets = onsetForms(syl.onset, sub);
  if (!onsets.length) return [];

  const splits = vowelCodaSplits(syl.vowel || "", syl.coda || "");
  if (!splits) return [];

  const out = [];
  for (const on of onsets) {
    for (const split of splits) {
      spellOne(out, on, split, isLast, false);
    }
  }

  // The series rules can legitimately rule out every spelling (an "a" after an
  // o-series-only consonant). Rather than give up, relax the series and take
  // the penalty, so the user always sees something to tap.
  if (!out.length) {
    for (const on of onsets) {
      for (const split of splits) {
        spellOne(out, on, split, isLast, true);
      }
    }
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

// An unlisted vowel run (proue) falls back to its longest known prefix, so a
// word never ends up with no spelling at all.
function vowelTable(vowel) {
  if (VOWEL[vowel]) return VOWEL[vowel];
  for (let n = vowel.length - 1; n >= 1; n--) {
    const hit = VOWEL[vowel.slice(0, n)];
    if (hit) return hit;
  }
  return { a: [], o: [] };
}

// Write one onset choice against one vowel/coda split, pushing every spelling
// that the rules allow. `relax` ignores the series constraint on the vowel.
function spellOne(out, on, split, isLast, relax) {
  const { vowel, units } = split;
  const base = on.score + split.bonus - (relax ? 1.5 : 0);
  // A leftover cluster is written with its last consonant (akk -> …ក).
  const coda = units.length ? units[units.length - 1] : "";

  // A vowel plus a final m or h fuses into one written unit (kom -> កុំ).
  const fused = (isLast && FUSED_LAST[vowel + coda]) || FUSED[vowel + coda];
  if (fused) {
    const signs = fused[on.series] || [];
    for (let i = 0; i < signs.length; i++) {
      out.push({ text: on.text + signs[i], score: base + 1.2 - i * 0.5 });
    }
  }
  const fusedS = FUSED_S[vowel + coda];
  if (fusedS) {
    for (const sign of fusedS[on.series] || []) {
      out.push({ text: on.text + sign, score: base + fusedS.bonus });
    }
  }

  // A trailing h is often just a long-vowel marker, not ះ (ah -> អា).
  const bare = coda === "h" ? "" : coda;
  const table = vowelTable(vowel);
  const signs = relax
    ? [...new Set([...(table.a || []), ...(table.o || [])])]
    : table[on.series] || [];

  for (let vi = 0; vi < signs.length; vi++) {
    const sign = signs[vi];
    const vScore = base - vi * 0.7;
    if (!bare) {
      out.push({ text: on.text + sign, score: vScore - (coda === "h" ? 0.9 : 0) });
      continue;
    }
    const codas = CODA[bare] || [];
    const bestCoda = codas.length ? Math.max(...codas.map(([, w]) => w)) : 1;
    for (const [codaKh, codaWeight] of codas) {
      const stem = on.text + sign + codaKh;
      const cScore = vScore + Math.log(codaWeight / bestCoda);
      out.push({ text: stem, score: cScore });
      // ់ only shortens the inherent vowel or ា, and almost always sits on the
      // last syllable of the word (angkor is អង្គរ, never អាង់កោ).
      if (BANTOC_VOWELS.has(sign)) {
        const bias = (BANTOC_BIAS[codaKh] || 0) - (isLast ? 0 : 2.0);
        out.push({ text: stem + BANTOC, score: cScore + bias });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// spell("pteah") -> ["ផ្ទះ", ...]  best first, deduped.
export function spell(word, limit = 3) {
  if (!word || !/^[a-z]+$/i.test(word)) return [];
  const sylls = syllabify(word);
  if (!sylls) return [];

  // Beam over the syllables: keep the best whole-word spellings as we go.
  let beam = [{ text: "", score: 0 }];
  for (let s = 0; s < sylls.length; s++) {
    const syl = sylls[s];
    const isLast = s === sylls.length - 1;
    const plain = spellSyllable(syl, false, isLast);
    // Inside a word, a syllable's onset may instead hang as a subscript under
    // the previous syllable's final consonant: angkor -> អង្គរ, not អាង់កោ.
    const subbed = s > 0 && syl.onset ? spellSyllable(syl, true, isLast) : [];
    if (!plain.length && !subbed.length) return [];

    const next = [];
    for (const partial of beam) {
      for (const opt of plain) {
        next.push({ text: partial.text + opt.text, score: partial.score + opt.score });
      }
      // Only legal when the spelling so far really ends on a base consonant.
      if (subbed.length && KH_CONS.has(partial.text.slice(-1))) {
        for (const opt of subbed) {
          next.push({
            text: partial.text + opt.text,
            score: partial.score + opt.score - 0.6,
          });
        }
      }
    }
    if (!next.length) return [];
    beam = next.sort((a, b) => b.score - a.score).slice(0, 14);
  }

  const seen = new Set();
  const out = [];
  for (const cand of beam) {
    if (seen.has(cand.text)) continue;
    seen.add(cand.text);
    out.push(cand.text);
    if (out.length >= limit) break;
  }
  return out;
}
