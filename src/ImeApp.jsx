import { useEffect, useMemo, useState } from "react";
import { convert } from "./converter.js";
import { suggest } from "./suggest.js";
import { host } from "./host.js";
import baseDictionary from "./dictionary.json";
import "./App.css";
import "./ime.css";

const CUSTOM_KEY = "khmer-custom-dict";
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

  const custom = useMemo(loadCustom, []);
  const dict = useMemo(() => ({ ...baseDictionary, ...custom }), [custom]);
  const { text } = useMemo(() => convert(buffer, dict), [buffer, dict]);
  const suggestions = useMemo(
    () => suggest(buffer, dict, learned),
    [buffer, dict, learned]
  );

  useEffect(() => host.onMock(setMock), []);

  function remember(typed, khmer) {
    const next = {
      picks: { ...learned.picks, [typed]: khmer },
      words: { ...learned.words, [khmer]: (learned.words[khmer] || 0) + 1 },
    };
    setLearned(next);
    localStorage.setItem(LEARNED_KEY, JSON.stringify(next));
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
    if (!buffer) return false;
    host.commit(convert(buffer, dict).text);
    setBuffer("");
    return true;
  }

  function onSpace() {
    if (buffer) commitBuffer();
    else host.space();
  }

  function onBackspace() {
    if (buffer) setBuffer((b) => b.slice(0, -1));
    else host.backspace();
  }

  function onReturn() {
    commitBuffer();
    host.enter();
  }

  function acceptSuggestion(s) {
    host.commit(s.khmer);
    if (s.type === "match") remember(buffer.toLowerCase(), s.khmer);
    setBuffer("");
  }

  const rows = page === "letters" ? LETTER_ROWS : SYMBOL_ROWS;

  function charKey(label) {
    const shown = shiftOn && /[a-z]/.test(label) ? label.toUpperCase() : label;
    return (
      <button
        key={label}
        className="key key-char"
        data-key={shown}
        onPointerDown={(e) => {
          e.preventDefault();
          type(label);
        }}
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

      <div className="ime-compose">
        <div className="ime-kh">
          {text ? text : <span className="ime-hint">វាយ Khmerlish…</span>}
        </div>
        <div className="ime-roman">{buffer || " "}</div>
      </div>

      <div className="suggest-strip">
        {suggestions.map((s, idx) => (
          <button
            key={s.khmer + idx}
            className={`chip ${s.type === "guess" ? "chip-guess" : ""}`}
            onPointerDown={(e) => {
              e.preventDefault();
              acceptSuggestion(s);
            }}
          >
            <span className="chip-kh">{s.khmer}</span>
            <span className="chip-roman">{s.key}</span>
          </button>
        ))}
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
              onPointerDown={(e) => {
                e.preventDefault();
                setShiftOn((v) => !v);
              }}
            >
              ⇧
            </button>
          ) : (
            <span className="key key-special key-wide key-ghost" />
          )}
          <div className="krow-mid">{rows[2].map(charKey)}</div>
          <button
            className="key key-special key-wide"
            onPointerDown={(e) => {
              e.preventDefault();
              onBackspace();
            }}
          >
            ⌫
          </button>
        </div>

        <div className="krow">
          <button
            className="key key-special key-mode"
            onPointerDown={(e) => {
              e.preventDefault();
              setPage((p) => (p === "letters" ? "symbols" : "letters"));
            }}
          >
            {page === "letters" ? "123" : "ABC"}
          </button>
          <button
            className="key key-special key-globe"
            onPointerDown={(e) => {
              e.preventDefault();
              host.switchKeyboard();
            }}
          >
            🌐
          </button>
          <button
            className="key key-space"
            onPointerDown={(e) => {
              e.preventDefault();
              onSpace();
            }}
          >
            space
          </button>
          <button
            className="key key-send"
            onPointerDown={(e) => {
              e.preventDefault();
              onReturn();
            }}
          >
            ⏎
          </button>
        </div>
      </div>
    </div>
  );
}
