import { readFileSync } from "node:fs";
import { suggest } from "../src/suggest.js";

const dict = JSON.parse(
  readFileSync(new URL("../src/dictionary.json", import.meta.url), "utf8")
);

const empty = { picks: {}, words: {} };
let failed = 0;

function check(name, cond, detail) {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "   " + detail}`);
}

// Prefix typing surfaces the common word first.
const kn = suggest("kn", dict, empty);
check(
  "kn suggests ខ្ញុំ first (frequency prior)",
  kn[0]?.khmer === "ខ្ញុំ",
  JSON.stringify(kn)
);

// Exact hits outrank longer prefix matches.
const te = suggest("te", dict, empty);
check("te suggests ទេ first (exact beats prefix)", te[0]?.khmer === "ទេ", JSON.stringify(te));

// Same Khmer word from several romanizations appears only once.
const s = suggest("s", dict, empty, 10);
const dupes = s.filter((c) => c.khmer === "ស្រឡាញ់").length;
check("no duplicate Khmer chips", dupes <= 1, JSON.stringify(s));

// A remembered pick for this exact typed string wins.
const learned = { picks: { kn: "ក្នុង" }, words: { "ក្នុង": 3 } };
const knLearned = suggest("kn", dict, learned);
check(
  "learned pick overrides the prior",
  knLearned[0]?.khmer === "ក្នុង",
  JSON.stringify(knLearned)
);

// Phrase entries surface while typing their first word.
const siem = suggest("siem", dict, empty);
check(
  "siem offers the siem reap phrase",
  siem.some((c) => c.khmer === "សៀមរាប"),
  JSON.stringify(siem)
);

// A two-word tail matches phrase entries and outranks the single-word reading of "ch".
const kch = suggest("kampong ch", dict, empty);
check(
  "kampong ch suggests a kampong province first with replaceWords 2",
  kch[0]?.khmer?.startsWith("កំពង់") && kch[0]?.replaceWords === 2,
  JSON.stringify(kch)
);
const kchh = suggest("kampong chh", dict, empty);
check(
  "kampong chh narrows to កំពង់ឆ្នាំង",
  kchh[0]?.khmer === "កំពង់ឆ្នាំង" && kchh[0]?.replaceWords === 2,
  JSON.stringify(kchh)
);

// Mid-sentence, the phrase tail still wins over the single-word reading.
const midSentence = suggest("jg tv siem re", dict, empty);
check(
  "jg tv siem re keeps suggesting siem reap",
  midSentence[0]?.khmer === "សៀមរាប" && midSentence[0]?.replaceWords === 2,
  JSON.stringify(midSentence)
);

// Unknown words fall back to a single low-confidence guess chip.
const gz = suggest("xyz", dict, empty);
check("unknown word yields a guess chip", gz.length === 1 && gz[0].type === "guess", JSON.stringify(gz));

// Non-typing input yields nothing.
check("empty input yields no chips", suggest("", dict, empty).length === 0);
check("numbers yield no chips", suggest("123", dict, empty).length === 0);

console.log(failed ? `${failed} test(s) failed` : "All suggestion tests passed");
process.exit(failed ? 1 : 0);
