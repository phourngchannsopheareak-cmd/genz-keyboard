// Bridge between the web keyboard and its host.
// Inside the Android app, the native side injects `window.AndroidIME` with
// commit / space / backspace / enter / switchKeyboard. In a normal browser
// none of that exists, so we fall back to a mock target string so the exact
// same UI can be tested on a desktop or phone browser.

const native = typeof window !== "undefined" ? window.AndroidIME : null;

let mock = "";
const listeners = new Set();
function emit() {
  for (const fn of listeners) fn(mock);
}

export const host = {
  isNative: !!native,

  commit(text) {
    if (native) native.commit(text);
    else {
      mock += text;
      emit();
    }
  },
  space() {
    if (native) native.space();
    else {
      mock += " ";
      emit();
    }
  },
  backspace() {
    if (native) native.backspace();
    else {
      mock = mock.slice(0, -1);
      emit();
    }
  },
  enter() {
    if (native) native.enter();
    else {
      mock += "\n";
      emit();
    }
  },
  switchKeyboard() {
    if (native && native.switchKeyboard) native.switchKeyboard();
    else console.log("[host] switch keyboard");
  },

  // Browser-only: observe the mock target text.
  onMock(fn) {
    listeners.add(fn);
    fn(mock);
    return () => listeners.delete(fn);
  },
};
