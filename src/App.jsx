import { useEffect, useMemo, useRef, useState } from "react";
import { convert } from "./converter.js";
import { suggest } from "./suggest.js";
import baseDictionary from "./dictionary.json";

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

export default function App() {
  const [buffer, setBuffer] = useState("");
  const [messages, setMessages] = useState([
    {
      side: "in",
      kh: "សួស្តី! សាកវាយ jg tv pteas មើល",
      roman: "Try typing: jg tv pteas",
    },
  ]);
  const [custom, setCustom] = useState(loadCustom);
  const [learned, setLearned] = useState(loadLearned);
  const [showWords, setShowWords] = useState(false);
  const [newRoman, setNewRoman] = useState("");
  const [newKhmer, setNewKhmer] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [shiftOn, setShiftOn] = useState(false);
  const [page, setPage] = useState("letters"); // "letters" | "symbols"
  const chatRef = useRef(null);

  const dict = useMemo(() => ({ ...baseDictionary, ...custom }), [custom]);
  const { text, tokens } = useMemo(() => convert(buffer, dict), [buffer, dict]);

  const context = buffer.endsWith(" ")
    ? ""
    : buffer.split(" ").filter(Boolean).slice(-3).join(" ");
  const suggestions = useMemo(
    () => suggest(context, dict, learned),
    [context, dict, learned]
  );

  function acceptSuggestion(s) {
    const n = s.replaceWords || 1;
    let idx = buffer.length;
    for (let i = 0; i < n; i++) idx = buffer.lastIndexOf(" ", idx - 1);
    const start = idx + 1;
    const typed = buffer.slice(start).toLowerCase();
    setBuffer(buffer.slice(0, start) + s.key + " ");
    if (s.type === "guess") return; // the letter-map fallback is not a word
    // A tapped spelling becomes a real custom word, so it converts from now on.
    if (s.type === "spell" && /^[a-z']+$/.test(typed)) {
      const words = { ...custom, [typed]: s.khmer };
      setCustom(words);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(words));
    }
    const next = {
      picks: { ...learned.picks, [typed]: s.khmer },
      words: { ...learned.words, [s.khmer]: (learned.words[s.khmer] || 0) + 1 },
    };
    setLearned(next);
    localStorage.setItem(LEARNED_KEY, JSON.stringify(next));
  }

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function type(ch) {
    let out = ch;
    if (shiftOn && /[a-z]/.test(ch)) {
      out = ch.toUpperCase();
      setShiftOn(false);
    }
    setBuffer((b) => b + out);
  }

  function backspace() {
    setBuffer((b) => b.slice(0, -1));
  }

  function send() {
    if (!text.trim()) return;
    setMessages((m) => [...m, { side: "out", kh: text, roman: buffer.trim() }]);
    setBuffer("");
    setShiftOn(false);
    setPage("letters");
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (showWords) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-z0-9'"]$/i.test(e.key)) {
        setBuffer((b) => b + e.key);
      } else if (e.key === " ") {
        e.preventDefault();
        setBuffer((b) => b + " ");
      } else if (e.key === "Backspace") {
        setBuffer((b) => b.slice(0, -1));
      } else if (e.key === "Enter") {
        send();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function saveWord() {
    const roman = newRoman.trim().toLowerCase();
    const khmer = newKhmer.trim();
    if (!roman || !khmer) return;
    const next = { ...custom, [roman]: khmer };
    setCustom(next);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
    setNewRoman("");
    setNewKhmer("");
  }

  // Copy every custom word as JSON, so they can be pasted anywhere (Telegram,
  // a note, back to the developer to merge into the shipped dictionary).
  async function copyAllWords() {
    const json = JSON.stringify(custom, null, 2);
    const n = Object.keys(custom).length;
    try {
      await navigator.clipboard.writeText(json);
      setCopyMsg(`Copied ${n} words. Paste them anywhere.`);
      return;
    } catch {
      /* clipboard API refused; fall back to the selection trick */
    }
    const area = document.createElement("textarea");
    area.value = json;
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      setCopyMsg(`Copied ${n} words. Paste them anywhere.`);
    } catch {
      setCopyMsg("Copy failed. Select the words and copy by hand.");
    }
    document.body.removeChild(area);
  }

  function removeWord(roman) {
    const next = { ...custom };
    delete next[roman];
    setCustom(next);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
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
    <div className="stage">
      <div className="brand">
        <span className="brand-mark">404 STUDIO</span>
        <span className="brand-sub">Genz Keyboard, web demo</span>
      </div>

      <div className="phone">
        <header className="phone-head">
          <div className="avatar">៤</div>
          <div className="head-meta">
            <div className="head-name">Genz Keyboard</div>
            <div className="head-status">typing demo</div>
          </div>
          <button className="head-btn" onClick={() => setShowWords(true)}>
            + word
          </button>
        </header>

        <div className="chat" ref={chatRef}>
          {messages.map((m, idx) => (
            <div key={idx} className={`bubble-row ${m.side}`}>
              <div className={`bubble ${m.side}`}>
                <div className="bubble-kh">{m.kh}</div>
                {m.roman ? <div className="bubble-roman">{m.roman}</div> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="composer">
          <div className="preview">
            {tokens.length === 0 ? (
              <span className="placeholder">វាយ Khmerlish នៅទីនេះ...</span>
            ) : (
              tokens.map((t, idx) => (
                <span key={idx} className={`tok tok-${t.type}`}>
                  {t.text}
                </span>
              ))
            )}
            <span className="caret" />
          </div>
          <div className="roman-echo">{buffer || "abc"}</div>
        </div>

        <div className="suggest-strip">
          {suggestions.map((s, idx) => (
            <button
              key={s.khmer + idx}
              className={`chip ${s.type !== "match" ? "chip-guess" : ""}`}
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
                backspace();
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
              className="key key-space"
              onPointerDown={(e) => {
                e.preventDefault();
                type(" ");
              }}
            >
              space
            </button>
            <button
              className="key key-send"
              onPointerDown={(e) => {
                e.preventDefault();
                send();
              }}
            >
              ➤
            </button>
          </div>
        </div>
      </div>

      <div className="legend">
        <span><i className="dot dot-match" /> in dictionary</span>
        <span><i className="dot dot-guess" /> guessed</span>
        <span><i className="dot dot-unknown" /> kept as typed</span>
      </div>

      {showWords && (
        <div className="overlay" onClick={() => setShowWords(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>My words</h2>
              <button className="modal-close" onClick={() => setShowWords(false)}>
                ✕
              </button>
            </div>
            <p className="modal-hint">
              Add your own slang. Saved on this device and used before the
              built-in dictionary.
            </p>
            <div className="modal-form">
              <input
                value={newRoman}
                onChange={(e) => setNewRoman(e.target.value)}
                placeholder="Romanized, ex: bby"
              />
              <input
                className="kh-input"
                value={newKhmer}
                onChange={(e) => setNewKhmer(e.target.value)}
                placeholder="Khmer, ex: សង្សារ"
              />
              <button className="modal-save" onClick={saveWord}>
                Save
              </button>
            </div>
            <div className="modal-form">
              <button className="modal-save" onClick={copyAllWords}>
                Copy all ({Object.keys(custom).length})
              </button>
              {copyMsg && <span className="modal-hint">{copyMsg}</span>}
            </div>
            <div className="word-list">
              {Object.keys(custom).length === 0 ? (
                <div className="word-empty">No custom words yet.</div>
              ) : (
                Object.entries(custom).map(([roman, kh]) => (
                  <div className="word-row" key={roman}>
                    <span className="word-roman">{roman}</span>
                    <span className="word-kh">{kh}</span>
                    <button className="word-del" onClick={() => removeWord(roman)}>
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
