import React from "react";
import ReactDOM from "react-dom/client";
import ImeApp, { WordsManager } from "./ImeApp.jsx";

// The same bundle serves two screens: the keyboard (default), and the
// "My Words" manager when opened with #manage (the Android launcher and the
// web link use this). Both touch the same localStorage, so a word added in
// the manager works in the keyboard immediately.
const manage =
  window.location.hash.includes("manage") ||
  window.location.search.includes("manage");

ReactDOM.createRoot(document.getElementById("ime-root")).render(
  <React.StrictMode>{manage ? <WordsManager /> : <ImeApp />}</React.StrictMode>
);
