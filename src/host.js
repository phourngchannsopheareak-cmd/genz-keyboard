// Bridge between the web keyboard and its host.
// - Android app: native side injects `window.AndroidIME`.
// - iOS app: native side exposes `window.webkit.messageHandlers.genz`, which
//   takes one message object { action, text }.
// - Plain browser: neither exists, so we fall back to a mock target string so
//   the exact same UI can be tested on a desktop or phone browser.

const android = typeof window !== "undefined" ? window.AndroidIME : null;
const ios =
  typeof window !== "undefined"
    ? window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.genz
    : null;
const isNative = !!(android || ios);

let mock = "";
const listeners = new Set();
function emit() {
  for (const fn of listeners) fn(mock);
}

function nativeCommit(text) {
  if (android) android.commit(text);
  else if (ios) ios.postMessage({ action: "commit", text });
}
function nativeSpace() {
  if (android) android.space();
  else if (ios) ios.postMessage({ action: "space", text: " " });
}
function nativeBackspace() {
  if (android) android.backspace();
  else if (ios) ios.postMessage({ action: "backspace", text: "" });
}
function nativeEnter() {
  if (android) android.enter();
  else if (ios) ios.postMessage({ action: "enter", text: "" });
}
function nativeSwitch() {
  if (android) {
    if (android.switchKeyboard) android.switchKeyboard();
  } else if (ios) ios.postMessage({ action: "switch", text: "" });
}

export const host = {
  isNative,

  commit(text) {
    if (isNative) nativeCommit(text);
    else {
      mock += text;
      emit();
    }
  },
  space() {
    if (isNative) nativeSpace();
    else {
      mock += " ";
      emit();
    }
  },
  backspace() {
    if (isNative) nativeBackspace();
    else {
      mock = mock.slice(0, -1);
      emit();
    }
  },
  enter() {
    if (isNative) nativeEnter();
    else {
      mock += "\n";
      emit();
    }
  },
  switchKeyboard() {
    if (isNative) nativeSwitch();
    else console.log("[host] switch keyboard");
  },

  // iOS only: tell the native keyboard how tall the web content is so it can
  // size the keyboard to fit. Android sets a fixed height on its side.
  reportHeight(px) {
    if (ios) ios.postMessage({ action: "height", text: String(Math.ceil(px)) });
  },

  // Browser-only: observe the mock target text.
  onMock(fn) {
    listeners.add(fn);
    fn(mock);
    return () => listeners.delete(fn);
  },
};
