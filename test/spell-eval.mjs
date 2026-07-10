// Grades the speller against the words the owner already checked by hand.
// Not a pass/fail test: it prints accuracy so we can tell if a rule change
// helped or hurt. Country names are transliterations, not Khmer spelling, so
// they are excluded.

import dict from "../src/dictionary.json" with { type: "json" };
import { spell } from "../src/spell.js";
import { guess } from "../src/converter.js";

const COUNTRIES = new Set(
  ("afghanistan albania algeria andorra angola argentina armenia australia austria azerbaijan " +
    "bahamas bahrain bangladesh barbados belarus belgium belize benin bhutan bolivia bosnia botswana " +
    "brazil brunei bulgaria burkina burundi cambodia cameroon canada chad chile china colombia comoros " +
    "congo croatia cuba cyprus czech denmark djibouti dominica ecuador egypt eritrea estonia eswatini " +
    "ethiopia fiji finland france gabon gambia georgia germany ghana greece grenada guatemala guinea " +
    "guyana haiti honduras hungary iceland india indonesia iran iraq ireland israel italy jamaica japan " +
    "jordan kazakhstan kenya kiribati kosovo kuwait kyrgyzstan laos latvia lebanon lesotho liberia libya " +
    "liechtenstein lithuania luxembourg madagascar malawi malaysia maldives mali malta mauritania mauritius " +
    "mexico micronesia moldova monaco mongolia montenegro morocco mozambique myanmar namibia nauru nepal " +
    "netherlands nicaragua niger nigeria norway oman pakistan palau palestine panama paraguay peru " +
    "philippines poland portugal qatar romania russia rwanda samoa senegal serbia seychelles singapore " +
    "slovakia slovenia somalia spain sudan suriname sweden switzerland syria taiwan tajikistan tanzania " +
    "thailand togo tonga tunisia turkey turkmenistan tuvalu uganda ukraine uruguay uzbekistan vanuatu " +
    "vatican venezuela vietnam yemen zambia zimbabwe korea lanka rico verde faso ivoire leone " +
    "arabia emirates kingdom states africa guinea zealand").split(/\s+/)
);

const all = Object.keys(dict)
  .filter((k) => /^[a-z]+$/.test(k))
  .filter((k) => !COUNTRIES.has(k));

// Vowel-less Gen-Z shorthand (jg, btb, bsd) carries no spelling information.
// The dictionary is the only thing that can ever resolve it, so grading the
// speller on it would just be measuring the wrong thing.
const shorthand = all.filter((k) => !/[aeiou]/.test(k));
const entries = all.filter((k) => /[aeiou]/.test(k));

let exact = 0;
let top3 = 0;
let empty = 0;
let baseline = 0;
const misses = [];

for (const key of entries) {
  const want = dict[key];
  if (guess(key) === want) baseline++;

  const cands = spell(key, 3);
  if (!cands.length) empty++;
  if (cands[0] === want) exact++;
  if (cands.includes(want)) top3++;
  else misses.push([key, want, cands.join(" ") || "(none)"]);
}

const pct = (n) => ((100 * n) / entries.length).toFixed(1) + "%";

console.log(`Khmer speller vs ${entries.length} hand-checked words`);
console.log(`(excluded: ${shorthand.length} vowel-less shorthand, dictionary-only)\n`);
console.log(`  old guess() exact   ${String(baseline).padStart(3)}  ${pct(baseline)}`);
console.log(`  spell() top-1       ${String(exact).padStart(3)}  ${pct(exact)}`);
console.log(`  spell() in top 3    ${String(top3).padStart(3)}  ${pct(top3)}`);
console.log(`  produced nothing    ${String(empty).padStart(3)}  ${pct(empty)}`);

if (process.argv.includes("--misses")) {
  const n = Number(process.argv[process.argv.indexOf("--misses") + 1]) || 40;
  console.log(`\n--- ${Math.min(n, misses.length)} of ${misses.length} misses ---`);
  for (const [k, want, got] of misses.slice(0, n)) {
    console.log(k.padEnd(14), "want", want.padEnd(16), "got", got);
  }
}
