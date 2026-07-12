# Genz Keyboard — handoff for the next session

Khmerlish → Khmer typing keyboard for Gen-Z Cambodians. Type `jg tv pteas`, get `ចង់ទៅផ្ទះ`.
Owner is **non-technical** (phone seller, Cambodia): give exact copy-paste steps, avoid terminal work for him, prefer zero-setup solutions. **He dislikes em-dash phrasing** in chat and app copy.

Project root: `D:\Desktop\claude\Session\khmer-keyboard`

---

## Status (2026-07-12) — everything works on all three platforms

| Platform | State |
|---|---|
| Web demo | Live, working (khmer-keyboard.pages.dev) |
| Android app | Real system keyboard, installed and confirmed on his phone |
| iPhone app | **Working via AltStore** (Sideloadly could not sign the keyboard extension; see gotcha 9) |
| Dictionary | **1,027 entries** (his ~500 + countries + 9 Gen-Z short forms + 217 phone-shop words) |
| Spelling engine | Live everywhere; spells unknown words, chips teach the dictionary |
| My Words | View/add/delete/copy-all on all three platforms |
| Apple feel | Balloon popup, Apple palettes, invert press, click + haptic, gap-free hit areas |

He confirmed the iPhone keyboard works and typing feels right after the fast-typing fixes shipped 2026-07-12 (commit `8427e10`). No open bug reports at handoff time.

### Links (use these exact URL forms)

- Web demo: https://khmer-keyboard.pages.dev
- Keyboard-only page: https://khmer-keyboard.pages.dev/ime.html
- My Words manager: https://khmer-keyboard.pages.dev/ime.html#manage
- Repo: https://github.com/phourngchannsopheareak-cmd/genz-keyboard (GitHub user `phourngchannsopheareak-cmd`)
- **Android APK**: `https://github.com/phourngchannsopheareak-cmd/genz-keyboard/releases/download/latest/genz-keyboard.apk`
- **iPhone IPA**: `https://github.com/phourngchannsopheareak-cmd/genz-keyboard/releases/download/ios-latest/GenzKeyboard.ipa`

> Use the **explicit-tag** form (`/releases/download/<tag>/<file>`). The `/releases/latest/download/...` form 404s whenever the iOS release publishes last. iOS release is marked `prerelease: true` to mitigate this.

---

## How to ship a change

```bash
npm test                 # 77 checks: converter, suggestions, speller, JS/Swift parity
npm run eval             # speller accuracy vs his hand-checked words (report, not pass/fail)
npm run prompt           # regenerate GEMINI-PROMPT.txt after ANY dictionary merge
npm run build            # dist/index.html + self-contained dist/ime.html
npx wrangler pages deploy dist --project-name khmer-keyboard --branch main --commit-dirty=true
git pull && git add -A && git commit -m "..." && git push
```

Pushing to `main` rebuilds **both** apps automatically:
- `.github/workflows/build-apk.yml` → signed `genz-keyboard.apk` on release tag `latest`
- `.github/workflows/build-ios.yml` → unsigned `GenzKeyboard.ipa` on release tag `ios-latest`

Watch CI without the API (gotcha 6): poll the release files' `Last-Modified` headers. iOS failures publish `xcodebuild.log` to release tag `ios-log`; if that file's timestamp becomes fresh, the Swift did not compile.

**His update flow after a push:** Android = reinstall the APK link. iPhone = download the IPA in Safari, then AltStore → My Apps → `+` → pick the file.

---

## Architecture

**One brain, three faces.** Dictionary + conversion + suggestion + spelling logic exists twice: JS (web + Android WebView) and a Swift port (iOS native).

```
src/dictionary.json   1,027 entries, romanized -> Khmer (words + phrases)
src/spell.js          spell(word, limit) -> candidate Khmer spellings from rules
src/converter.js      convert(input, dict) -> {text, tokens}
src/suggest.js        suggest(context, dict, learned) -> ranked candidates
src/host.js           bridge: window.AndroidIME | webkit genz handler | browser mock
src/ImeApp.jsx        keyboard UI + WordsManager (ime.html#manage)
src/App.jsx           chat-style demo site (has My Words modal + Copy All)
ime.html              entry for the keyboard-only page
scripts/gemini-prompt.mjs   regenerates GEMINI-PROMPT.txt from the dictionary
android/              Kotlin. WebView IME + SetupActivity + WordsActivity
ios/                  Swift. FULLY NATIVE keyboard (NO WebView). XcodeGen project
```

### The spelling engine (`src/spell.js` ⇄ `ios/Keyboard/Speller.swift`)

Spells ANY word from Khmer orthography rules: syllable = onset + vowel + coda, extra onset consonants hang as subscripts (coeng), so `pteah` → `ផ្ទះ`. Khmer writes each consonant sound in two series (`t` = ត or ទ) and romanization loses that, so it offers 2-3 candidates as gold chips; **tapping one saves it to the custom dictionary**, so each word only ever needs spelling once. Accuracy (`npm run eval`): top-3 ≈ 39% on his slang corpus, ≈ 77% on ordinary Khmer words. Loanwords/Pali spellings (`akun` → អរគុណ) and vowel-less shorthand (`jg`) are dictionary-only by nature.

### Mirroring rules (things exist twice and drift)

- **Engine:** change `converter.js` / `suggest.js` / `spell.js` → mirror in `ios/Keyboard/Engine.swift` / `Speller.swift`. `test/ios-parity.mjs` (in `npm test`) diffs the speller **tables** (Khmer letters + weights) between the two files; it cannot check algorithms, so scoring changes are mirrored by hand. Keep declaration order identical or the check breaks.
- **UI:** `src/ImeApp.jsx` + `src/ime.css` (web/Android) ⇄ `KeyboardViewController.swift` (iOS). No auto-check. Verify web in the browser, port to Swift by eye.

### The Apple feel (his explicit requirement)

- **Balloon popup** with the tapped letter above the finger. Instant on touch, quick fade on release. Letter keys do NOT dim; the balloon is the feedback.
- **Invert press:** gray function keys flip to white while held, space flips to gray, return darkens. Snap on press, 0.12s ease back.
- **Apple palettes** light and dark (dark is Apple grays, not the brand brown). Gold only on return + speller chips.
- **Click feel:** iOS plays the system click (`UIInputViewAudioFeedback` extension + `playInputClick`) + light haptic (needs Full Access). Android gets `navigator.vibrate(8)`.
- Web drives press states with a JS `pressed` class because `preventDefault()` on pointerdown kills `:active` in Chrome/WebView (the old `:active` balloon NEVER showed on Android).
- **Prediction bar is two-tier:** slim typed-romanization line on top, Khmer candidates full-width in even columns below (his feedback: side-by-side looked small).

### Fast-typing smoothness (2026-07-12, load-bearing, do not undo)

- **Gap-free hit areas.** Keys claim half of every gutter. Web: `.key::before { inset: -6px -4px }` (App.css). iOS: `KeyButton.hitInsets` PLUS the `KeyRow` UIStackView subclass; a stack view refuses hit-tests outside its bounds, so without KeyRow the expanded key areas are unreachable in row gutters (the subtle part).
- **Balloon ownership** (`popupOwner`): rolled typing lifts finger 1 after finger 2 is down; only the owning key hides the balloon.
- **Per-keystroke cost:** `Engine.suggest` scans a first-letter bucket, not all 1,027 entries (buckets built in init, appended/updated in `accept`, including re-taught keys); the speller is skipped when the dictionary already filled the strip (mirrored in suggest.js, output-identical); hot-path regexes replaced with character walks (NSRegularExpression recompiles per call); balloon has an explicit `shadowPath` (else it re-rasterizes offscreen every keystroke); `haptic.prepare()` after each impact keeps the Taptic Engine warm.
- iOS shift retitles keys in place instead of rebuilding rows (rebuild mid-touch janks and strands the balloon).

### My Words (view / add / delete / copy out) — all platforms

One manager page `ime.html#manage` (`WordsManager` in ImeApp.jsx): list, add, delete, **Copy All as JSON**, plus an always-visible JSON box for manual copy where clipboard APIs refuse (file:// WebViews).
- **Web:** khmer-keyboard.pages.dev/ime.html#manage; the demo's My Words modal also has Copy All.
- **Android:** launcher button "My words" opens `WordsActivity` (WebView on the bundled ime.html#manage). WebViews in one app share localStorage, so it edits the keyboard's REAL words. Verified: add in manager → instant dictionary-match chip in keyboard.
- **iPhone:** **hold the space bar 1 second** → the keyboard TYPES the saved words as JSON into the open app (extensions cannot share files without an App Group, which free signing breaks; typing is the export). Space acts on touch-up so the long press works.
- **iPhone ADD (2026-07-12 session 2):** the container app now has a **My Words screen** (gold button on the launcher screen; `ios/App/WordsViewController.swift`) with add + list + swipe-delete. App → keyboard transport is a **private same-team named pasteboard** `com.reak.genzkeyboard.words` (no App Group under free signing): the app rewrites the full list as JSON on every change AND on every screen appearance (named pasteboards die on restart), the keyboard merges it via `Engine.addWords` in `viewWillAppear` (idempotent, needs Full Access, no paste banner because it is not the general pasteboard). App-side copy lives in the app's own `UserDefaults` key `genz-app-words`; deleting there does NOT delete from the keyboard's `genz-custom`. **CONFIRMED WORKING on his iPhone, but ONLY with Allow Full Access ON**: with it off the import silently does nothing (looks like the bridge is broken; it is not, do not rearchitect). The keyboard needs Full Access anyway for haptics, so this is only a first-setup trap.
- His words → me → `src/dictionary.json` is how personal words become shipped words for everyone.

---

## Growing the dictionary (the working batch workflow)

1. He opens `GEMINI-PROMPT.txt`, copies ALL of it into a fresh Gemini chat. It contains the format rules AND a do-not-repeat list of all current keys (this cut repeats from 123-of-132 to 0-of-236).
2. He sends Gemini a category line (e.g. `food and drink words`), pastes Gemini's JSON back to us.
3. We clean + merge with a dry run first (a `clean-merge.mjs` style script; see commit `895a0e2` for the drop rules). **Drop:** keys with non-latin chars/accents; spelled-out-number values (`128gb` → words); semantic overrides of common words. The critical guard: **`luy` must stay លុយ (money)**, `knong` = ក្នុង. Conflicts keep the existing value.
4. `npm test` (must stay green), `npm run prompt` (refresh the exclusion list), build, deploy, push.
5. Suggested next categories he has NOT done: food/drink, money/numbers/time, family, love/flirting, feelings, school/work, travel/places.
   Done already: Gen-Z chat (mostly known), phone-shop (217 words, 2026-07-11).

Target ~2,000-3,000 curated entries, not 10K raw: nobody can verify 10K spellings, junk crowds the suggestion strip, and the speller + chip-teaching grows the long tail by itself.

---

## Hard-won gotchas (do not relearn these)

1. **iOS keyboard extensions have a tiny memory limit (~60-70MB).** A WKWebView keyboard gets killed instantly and iOS silently falls back to another keyboard. This is why iOS is native. **Never put a WebView in the iOS keyboard.**
2. **Android WebView blocks ES-module scripts from `file://`.** `ime.html` is ONE self-contained file via `vite-plugin-singlefile` with separate config `vite.ime.config.js` (MPA + singlefile cannot combine); the ime build uses `emptyOutDir: false`.
3. **An Android IME view has no natural height** and collapses to zero. `KhmerImeService` sets explicit height (300dp) and resizes via the JS `resize` bridge.
4. **iOS builds need macos-15 + Xcode 16.** Xcode 15.4 fails with `future Xcode project file format (77)` from XcodeGen.
5. **GitHub Actions logs are 403 without auth.** The iOS workflow publishes `xcodebuild.log` to release tag `ios-log` on failure; fetch it anonymously via the release download URL.
6. **Anonymous GitHub API rate-limits fast (60/hr).** Poll release assets' `Last-Modified` via `github.com` download URLs, not `api.github.com` loops.
7. **Android signing:** CI generated `android/app/genz.keystore` once and committed it back with `[skip ci]` (passwords `genzkeystore`, alias `genz`). **Always `git pull` before pushing.** Updates install over the old app.
8. **Never rename these storage keys:** localStorage `khmer-custom-dict` (own words) and `khmer-learned-v1` (`{picks, words}`); iOS `UserDefaults` `genz-picks` / `genz-words` / `genz-custom` / `genz-bigrams` (next-word pairs, iOS-only, added 2026-07-13).
9. **iPhone signing (the week-long saga, resolved):** Sideloadly signs the container app but NOT the nested `Keyboard.appex` in a way iOS 26 accepts → extension dies at launch with `CODESIGNING / Invalid Page` SIGKILL and iOS silently shows the **system Khmer keyboard** instead (because our plist says `PrimaryLanguage km-KH`). That fallback Khmer keyboard IS the "extension failed to launch" symptom. **AltStore signs the appex correctly and is his working install path.** Same free cert runs fine on his iPad (iOS 17.7), so it is an iOS-26 enforcement wall, not a universal free-cert wall. The durable paid fix remains TestFlight ($99/yr) if AltStore ever breaks.
10. **AltServer on Windows needs apple.com iTunes AND apple.com iCloud** (never Microsoft Store versions). When AltServer says "iCloud Not Found", use its **Choose Folder** and point it at `C:\Program Files (x86)\Common Files\Apple` (folder must contain `Apple Application Support` + `Internet Services`). His first-ever AltStore attempt failed on a broken legacy iCloud install; the fix above worked on the second attempt. The 7-day cert auto-refreshes over WiFi while AltServer runs on the same network; if the keyboard dies, AltStore → My Apps → Refresh All.
11. **His Apple IDs:** the first got locked by Apple during sideloading (error -20209); only the **second iCloud** is used. The iPhone was renamed to a plain name to fix Sideloadly error 35 (historical).
12. **Free-cert bundle ids get rewritten** (`com.reak.genzkeyboard.2R74FR674S.keyboard`); that is normal, not a bug.

---

## Backlog (his priorities, roughly in order)

1. **Real-world speller feedback.** He types with it daily now; ask which gold chips are wrong or missing. Known weak spots: loanwords/Pali need dictionary entries; `angkor`-style subscript-at-junction is weakly ranked; vowel-less shorthand is dictionary-only.
2. **More word batches** via the Gemini workflow above (food/drink next).
3. **No-spaces auto-split** so `jgtvpteas` splits into words.
4. ~~Typo tolerance~~ **shipped iOS-only, 2026-07-13** (`Engine.fuzzyMatches` + `levenshtein`). Port to JS (`src/suggest.js`) for web/Android if he asks.
5. ~~Next-word prediction~~ **shipped iOS-only, 2026-07-13** (`genz-bigrams`, `Engine.predictNext`/`wordAccepted`/`resetChain`). Port to JS for web/Android if he asks.
6. **App icons**: iOS is default, Android could be nicer.
7. (Someday) TestFlight if AltStore becomes a burden or he wants tap-a-link installs for testers.

## Word-merge decisions already made (do not re-litigate)

His original entries: `ko`=ក៏, `mon`=មុន, `tuk`=ទុក, `chol`=ចោល, `der`=ដែរ (walk = `daer`), `sl`=ស្រឡាញ់, `oy`=ឱ្យ, `mish`=ម៉េច. Normalized: `klirn`→ក្លិន, `dor`→ដ៏, `krr os`→ក៏អស់, `j'rik`→ចរិត. Flagged as possibly wrong but kept verbatim (worth re-asking him someday): `hork`=ហហ, `klat`=ខ្លាត, `tork`=តុក, `meban`=មេបាយ, `krep`=ប្រៃ, `kork lok`=កូឡុក, `zambia`=សំប៊ី, `cyprus`=ស៊ីពរ៍.
From the phone-shop batch, deliberately dropped: `luy`→តម្លៃ, `khnong`→មេម៉ូរី, `jeung`→ជាង (all would break common words), all `%`/GB spelled-out-number keys, and keys containing Khmer characters.

## Session history (compact)

- **2026-07-08/09:** Web demo built + deployed; Android WebView IME built, works on his phone; his ~500 words merged.
- **2026-07-09/10:** iOS WebView keyboard died (memory limit) → full native rewrite (Engine + programmatic UIKit).
- **2026-07-10:** Sideloadly installed the app but the keyboard extension was SIGKILLed (`CODESIGNING`); long diagnosis; first AltStore attempt failed on broken iCloud; discovered the same build WORKS on his iOS-17 iPad. Spelling engine built (JS + Swift + parity test), chips teach the dictionary.
- **2026-07-11 (this session):** AltStore fixed via the Choose Folder trick → **iPhone works**. Apple-style suggestion bar (two-tier, full width). 9 short forms + 217 phone-shop words merged (dictionary 1,027). Apple keyboard feel shipped (balloon, palettes, invert press, click + haptic). My Words manager on all platforms + copy-all export + iOS hold-space export.
- **2026-07-12:** Fast-typing fixes (gap-free hit areas incl. the KeyRow trick, balloon ownership, bucketed suggest, speller skip, shadowPath, haptic prepare). He confirmed it feels good. `npm run prompt` script added. This handoff rewritten.
- **2026-07-12 (session 2), iOS only:** (1) **Live typing:** letters now insert into the host text field as typed (`charTapped` inserts, `doBackspace` always deletes from the proxy); on commit/chip-tap `removeTypedRomanization()` deletes the buffer from the field ONLY if `documentContextBeforeInput` ends with it (cursor-move safety), then inserts the Khmer; stale buffer forgotten in `viewWillAppear`. This matches the Apple-keyboard feel he asked for (letters visible in the box while composing). (2) **My Words add screen** in the container app + named-pasteboard bridge (see My Words section). Android/web NOT yet given live typing; port only if he asks.
- **2026-07-13, iOS only:** (1) **Typo tolerance**: `Engine.suggest` tries a Levenshtein fuzzy match (`.fuzzy` kind, gold) against the same first-letter bucket when the dictionary pass didn't fill the strip, distance 1-3 scaled by word length, only for the final word and only when it's ≥3 letters. (2) **Next-word prediction**: `Engine.wordAccepted(khmer)` called after every commit/chip-tap builds a `[prevWord: [nextWord: count]]` table (`genz-bigrams`); `suggest("")` now returns `predictNext()` instead of an empty strip, so the top predicted continuations show before any letter is typed. `resetChain()` on Return breaks the chain across lines. `lastAccepted` is in-memory only (see storage-keys gotcha). New `Kind` cases `.fuzzy`/`.predict` added; `Suggestion.isGuess` rewritten as an explicit switch (fuzzy/spell/guess = gold, match/predict = confident). Both features are iPhone-only per his choice; JS/web/Android untouched, do not assume parity, `ios-parity` test only ever covered the speller tables anyway.
