// Regenerates GEMINI-PROMPT.txt from the current dictionary, so the owner's
// next word batch excludes every word we already have. Run after EVERY merge
// into src/dictionary.json:  npm run prompt
import { readFileSync, writeFileSync } from "node:fs";

const dict = JSON.parse(readFileSync(new URL("../src/dictionary.json", import.meta.url), "utf8"));
const keys = Object.keys(dict).sort().join(", ");

const prompt = `You are building the dictionary for Genz Keyboard, a Khmerlish keyboard for Cambodians. Khmerlish is Khmer typed with English letters on a normal phone keyboard. The keyboard converts it to real Khmer script.

Examples: nis = នេះ, nham = ញ៉ាំ, srolanh = ស្រឡាញ់, jg = ចង់ (short form), 555 = ហាហាហា

HOW WE WORK: After this message, I will send you a CATEGORY name. You reply with 200 dictionary entries for that category. When I say: more, you give 200 NEW entries in the same category that you did not give before. When I send a different category name, you switch to it.

STRICT RULES:
1. Output ONLY a JSON object. No explanation, no markdown, no code fences.
2. Exact format: {"khmerlish": "ខ្មែរ", "nis": "នេះ"}
3. Keys are what a real young Cambodian actually types: lowercase English letters only (a to z), apostrophe allowed, spaces only inside short phrases. NEVER put Khmer letters, accents, percent signs, or a full spelled-out number in a key.
4. Values are correct modern Khmer spelling, Khmer script only. Check every spelling twice.
5. Include popular short forms and slang. If a word is commonly typed two ways, give both keys with the same Khmer value.
6. No duplicate keys inside your answer.
7. NEVER use any key from the DO NOT REPEAT list below. We already have all of them.

DO NOT REPEAT (${Object.keys(dict).length} keys already in the keyboard):
${keys}

Reply OK if you understand, then wait for my category.`;

writeFileSync(new URL("../GEMINI-PROMPT.txt", import.meta.url), prompt, "utf8");
console.log(`GEMINI-PROMPT.txt regenerated, excludes ${Object.keys(dict).length} keys`);
