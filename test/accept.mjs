import { readFileSync } from "node:fs";
import { convert } from "../src/converter.js";

const dictionary = JSON.parse(
  readFileSync(new URL("../src/dictionary.json", import.meta.url), "utf8")
);

const cases = [
  ["nis", "នេះ"],
  ["nham ey nv", "ញ៉ាំអីនៅ"],
  ["jg tv pteas", "ចង់ទៅផ្ទះ"],
  ["otniyeay", "អត់និយាយ"],
  ["komsl", "កុំស្រឡាញ់"],
  ["mon sach", "សាច់មាន់"],
  ["khmer", "ខ្មែរ"],
  // user-supplied words, 2026-07-09
  ["mish", "ម៉េច"],
  ["jj", "ចូលចិត្ត"],
  ["555", "ហាហាហា"],
  ["tt hx", "ទៀតហើយ"],
  ["ort vv te", "អត់វល់ទេ"],
  ["sbk jg", "ស្បែកជើង"],
  ["otmn", "អត់មាន"],
  ["knh sl b", "ខ្ញុំស្រឡាញ់បង"],
  // countries, 2026-07-09
  ["cambodia", "កម្ពុជា"],
  ["south korea", "កូរ៉េខាងត្បូង"],
  ["barang", "បារាំង"],
  ["ukraine", "អ៊ុយក្រែន"],
  ["knhom jg tv thai", "ខ្ញុំចង់ទៅថៃ"],
  // provinces, 2026-07-09
  ["siem reap", "សៀមរាប"],
  ["battambang", "បាត់ដំបង"],
  ["jg tv kampot", "ចង់ទៅកំពត"],
  ["kps", "ព្រះសីហនុ"],
];

let failed = 0;
for (const [input, expected] of cases) {
  const { text } = convert(input, dictionary);
  const ok = text === expected;
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${input}  ->  ${text}${ok ? "" : `   (expected ${expected})`}`
  );
}
console.log(failed ? `${failed} test(s) failed` : "All acceptance tests passed");
process.exit(failed ? 1 : 0);
