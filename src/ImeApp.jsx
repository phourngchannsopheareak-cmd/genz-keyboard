import { useEffect, useMemo, useRef, useState } from "react";
import { convert } from "./converter.js";
import { suggest } from "./suggest.js";
import { host } from "./host.js";
import baseDictionary from "./dictionary.json";
import "./App.css";
import "./ime.css";

export const CUSTOM_KEY = "khmer-custom-dict";
const LEARNED_KEY = "khmer-learned-v1";

const LETTER_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const SYMBOL_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "$", "&", "@", "'"],
  [".", ",", "?", "!", "\""],
];

function loadCustom() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}");
  } catch {
    return {};
  }
}

function loadLearned() {
  try {
    const data = JSON.parse(localStorage.getItem(LEARNED_KEY) || "{}");
    return { picks: data.picks || {}, words: data.words || {} };
  } catch {
    return { picks: {}, words: {} };
  }
}

export default function ImeApp() {
  const [buffer, setBuffer] = useState("");
  const [shiftOn, setShiftOn] = useState(false);
  const [page, setPage] = useState("letters");
  const [learned, setLearned] = useState(loadLearned);
  const [mock, setMock] = useState("");

  const [custom, setCustom] = useState(loadCustom);
  const dict = useMemo(() => ({ ...baseDictionary, ...custom }), [custom]);
  const suggestions = useMemo(
    () => suggest(buffer, dict, learned),
    [buffer, dict, learned]
  );

  // Keep a live copy of the buffer so the backspace repeat timer sees it.
  const bufferRef = useRef("");
  useEffect(() => {
    bufferRef.current = buffer;
  }, [buffer]);

  useEffect(() => host.onMock(setMock), []);

  // Tell iOS how tall the keyboard content is, measured from the bar + keys
  // (not the root, which is stretched to fill whatever height iOS gave us).
  useEffect(() => {
    const bar = document.querySelector(".predict-bar");
    const kbd = document.querySelector(".keyboard");
    const h = (bar ? bar.offsetHeight : 0) + (kbd ? kbd.offsetHeight : 0);
    if (h) host.reportHeight(h);
  }, [page, buffer]);

  function remember(typed, khmer) {
    const next = {
      picks: { ...learned.picks, [typed]: khmer },
      words: { ...learned.words, [khmer]: (learned.words[khmer] || 0) + 1 },
    };
    setLearned(next);
    localStorage.setItem(LEARNED_KEY, JSON.stringify(next));
  }

  // A spelled word the user taps becomes a real dictionary word, so the next
  // time it is typed it comes back as a plain match. This is how the
  // dictionary grows without anyone editing dictionary.json.
  function learnSpelling(typed, khmer) {
    if (!/^[a-z']+$/.test(typed)) return;
    const next = { ...custom, [typed]: khmer };
    setCustom(next);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
  }

  // Accepting a chip: record the pick, and save a spelling as a new word.
  function accept(typed, s) {
    const key = typed.toLowerCase();
    if (s.type === "spell") learnSpelling(key, s.khmer);
    remember(key, s.khmer);
  }

  function type(ch) {
    let out = ch;
    if (shiftOn && /[a-z]/.test(ch)) {
      out = ch.toUpperCase();
      setShiftOn(false);
    }
    setBuffer((b) => b + out);
  }

  function commitBuffer() {
    const b = bufferRef.current;
    if (!b) return;
    // Space / return accept the best suggestion (like iPhone), falling back to
    // the letter-by-letter conversion only if there is no suggestion.
    const top = suggest(b, dict, learned)[0];
    const khmer = top ? top.khmer : convert(b, dict).text;
    host.commit(khmer);
    if (top && top.type !== "guess") accept(b, top);
    setBuffer("");
  }

  function onSpace() {
    if (bufferRef.current) commitBuffer();
    else host.space();
  }

  function onBackspace() {
    if (bufferRef.current) setBuffer((b) => b.slice(0, -1));
    else host.backspace();
  }

  function onReturn() {
    commitBuffer();
    host.enter();
  }

  function acceptSuggestion(s) {
    host.commit(s.khmer);
    if (s.type !== "guess") accept(buffer, s);
    setBuffer("");
  }

  // Press feedback. The `pressed` class drives the letter balloon and the
  // Apple-style key invert in CSS; :active never applies because pointerdown
  // is prevented. The tiny vibration is the Android click feel (iOS keyboard
  // is native and does its own sound + haptic; browsers without vibrate
  // simply skip it).
  function pressStart(e, action) {
    e.preventDefault();
    e.currentTarget.classList.add("pressed");
    try {
      if (navigator.vibrate) navigator.vibrate(8);
    } catch {
      /* vibration is best-effort */
    }
    if (action) action();
  }

  function pressEnd(e) {
    e.currentTarget.classList.remove("pressed");
  }

  // Hold-to-repeat for the backspace key. Window listeners make it stop no
  // matter where the finger lifts.
  const holdTimer = useRef(null);
  const holdInterval = useRef(null);
  function makeStop() {
    return function stop() {
      clearTimeout(holdTimer.current);
      clearInterval(holdInterval.current);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }
  function startBackspace() {
    onBackspace();
    holdTimer.current = setTimeout(() => {
      holdInterval.current = setInterval(onBackspace, 55);
    }, 400);
    const stop = makeStop();
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  const rows = page === "letters" ? LETTER_ROWS : SYMBOL_ROWS;

  function charKey(label) {
    const shown = shiftOn && /[a-z]/.test(label) ? label.toUpperCase() : label;
    return (
      <button
        key={label}
        className="key key-char"
        data-key={shown}
        onPointerDown={(e) => pressStart(e, () => type(label))}
        onPointerUp={pressEnd}
        onPointerCancel={pressEnd}
        onLostPointerCapture={pressEnd}
      >
        {shown}
      </button>
    );
  }

  return (
    <div className="ime-root">
      {!host.isNative && (
        <div className="ime-target">
          <span className="ime-target-label">Test box (this is where your typing goes)</span>
          <div className="ime-target-text">
            {mock || <span className="ime-target-empty">type below…</span>}
            <span className="caret" />
          </div>
        </div>
      )}

      {/* Prediction bar: a slim line shows what you typed, then the Khmer
          candidates fill the full width in even columns, like Apple's row. */}
      <div className="predict-bar">
        <div className="predict-compose">
          {buffer ? (
            <span className="predict-roman">{buffer}</span>
          ) : (
            <span className="predict-hint">វាយ Khmerlish ។ ឧ. jg tv pteas</span>
          )}
        </div>
        <div className="predict-chips">
          {suggestions.map((s, idx) => (
            <button
              key={s.khmer + idx}
              className={`chip ${s.type !== "match" ? "chip-guess" : ""}`}
              onPointerDown={(e) => pressStart(e, () => acceptSuggestion(s))}
              onPointerUp={pressEnd}
              onPointerCancel={pressEnd}
              onLostPointerCapture={pressEnd}
            >
              <span className="chip-kh">{s.khmer}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="keyboard">
        <div className="krow">{rows[0].map(charKey)}</div>

        <div className="krow">
          {page === "letters" && <span className="kspacer" />}
          {rows[1].map(charKey)}
          {page === "letters" && <span className="kspacer" />}
        </div>

        <div className="krow">
          {page === "letters" ? (
            <button
              className={`key key-special key-wide ${shiftOn ? "key-shift-on" : ""}`}
              onPointerDown={(e) => pressStart(e, () => setShiftOn((v) => !v))}
              onPointerUp={pressEnd}
              onPointerCancel={pressEnd}
              onLostPointerCapture={pressEnd}
            >
              ⇧
            </button>
          ) : (
            <span className="key key-special key-wide key-ghost" />
          )}
          <div className="krow-mid">{rows[2].map(charKey)}</div>
          <button
            className="key key-special key-wide"
            onPointerDown={(e) => pressStart(e, startBackspace)}
            onPointerUp={pressEnd}
            onPointerCancel={pressEnd}
            onLostPointerCapture={pressEnd}
          >
            ⌫
          </button>
        </div>

        <div className="krow">
          <button
            className="key key-special key-mode"
            onPointerDown={(e) =>
              pressStart(e, () => setPage((p) => (p === "letters" ? "symbols" : "letters")))
            }
            onPointerUp={pressEnd}
            onPointerCancel={pressEnd}
            onLostPointerCapture={pressEnd}
          >
            {page === "letters" ? "123" : "ABC"}
          </button>
          <button
            className="key key-special key-globe"
            onPointerDown={(e) => pressStart(e, () => host.switchKeyboard())}
            onPointerUp={pressEnd}
            onPointerCancel={pressEnd}
            onLostPointerCapture={pressEnd}
          >
            🌐
          </button>
          <button
            className="key key-space"
            onPointerDown={(e) => pressStart(e, onSpace)}
            onPointerUp={pressEnd}
            onPointerCancel={pressEnd}
            onLostPointerCapture={pressEnd}
          >
            space
          </button>
          <button
            className="key key-send"
            onPointerDown={(e) => pressStart(e, onReturn)}
            onPointerUp={pressEnd}
            onPointerCancel={pressEnd}
            onLostPointerCapture={pressEnd}
          >
            ⏎
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// "My Words" manager. Full-screen page opened with ime.html#manage: from the
// Android launcher app (a WebView sharing the keyboard's localStorage) or on
// the web. Lists the words this device has saved (typed chips + manual adds),
// lets the owner add and delete, and copies everything out as JSON so the
// words can be sent anywhere (Telegram, to the developer, another phone).
// ---------------------------------------------------------------------------
export function WordsManager() {
  const [custom, setCustom] = useState(loadCustom);
  const [roman, setRoman] = useState("");
  const [khmer, setKhmer] = useState("");
  const [status, setStatus] = useState("");
  const areaRef = useRef(null);

  const entries = Object.entries(custom).sort((a, b) => a[0].localeCompare(b[0]));
  const json = JSON.stringify(custom, null, 2);

  function persist(next) {
    setCustom(next);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
  }

  function add() {
    const r = roman.trim().toLowerCase();
    const k = khmer.trim();
    if (!r || !k) {
      setStatus("Fill both boxes first");
      return;
    }
    if (!/^[a-z0-9' ]+$/.test(r)) {
      setStatus("Left box must be English letters (a-z)");
      return;
    }
    persist({ ...custom, [r]: k });
    setRoman("");
    setKhmer("");
    setStatus(`Saved "${r}"`);
  }

  function remove(r) {
    const next = { ...custom };
    delete next[r];
    persist(next);
    setStatus(`Removed "${r}"`);
  }

  // Copy is best-effort in three steps: the clipboard API (https), then the
  // old execCommand path (file:// WebView), and if both refuse, the JSON box
  // below is selected so one long-press Copy finishes the job.
  async function copyAll() {
    const area = areaRef.current;
    try {
      await navigator.clipboard.writeText(json);
      setStatus(`Copied ${entries.length} words. Paste them anywhere.`);
      return;
    } catch {
      /* fall through to the selection path */
    }
    if (area) {
      area.focus();
      area.select();
      try {
        if (document.execCommand("copy")) {
          setStatus(`Copied ${entries.length} words. Paste them anywhere.`);
          return;
        }
      } catch {
        /* fall through */
      }
      setStatus("Selected. Long-press the box and tap Copy.");
    }
  }

  return (
    <div className="manage-root">
      <h1 className="manage-title">My Words</h1>
      <p className="manage-hint">
        Words saved on this device: the gold chips you tapped while typing,
        plus anything you add here. The keyboard uses them right away. Copy
        All puts them in your clipboard so you can paste them anywhere.
      </p>

      <div className="manage-form">
        <input
          value={roman}
          onChange={(e) => setRoman(e.target.value)}
          placeholder="typing, ex: bby"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <input
          className="manage-kh"
          value={khmer}
          onChange={(e) => setKhmer(e.target.value)}
          placeholder="Khmer, ex: សង្សារ"
        />
        <button className="manage-add" onClick={add}>
          Save
        </button>
      </div>

      <div className="manage-actions">
        <button className="manage-copy" onClick={copyAll}>
          Copy all ({entries.length})
        </button>
        <span className="manage-status">{status}</span>
      </div>

      <textarea
        ref={areaRef}
        className="manage-json"
        readOnly
        value={json}
        rows={Math.min(10, entries.length + 2)}
      />

      <div className="manage-list">
        {entries.length === 0 ? (
          <div className="manage-empty">
            No saved words yet. Type on the keyboard and tap a gold chip, or
            add one above.
          </div>
        ) : (
          entries.map(([r, k]) => (
            <div className="manage-row" key={r}>
              <span className="manage-roman">{r}</span>
              <span className="manage-word">{k}</span>
              <button className="manage-del" onClick={() => remove(r)}>
                delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
