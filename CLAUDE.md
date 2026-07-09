# Khmer Slang Keyboard — Build Spec (for Claude Code)

## What we're building

A **web demo of a Khmer typing keyboard** for Gen-Z Cambodians. The user types romanized Khmer slang ("Khmerlish", e.g. `nis`, `nham`, `jg tv pteas`) and it converts live to real Khmer script (នេះ, ញ៉ាំ, ចង់ទៅផ្ទះ).

This is a **Vite \+ React** project. The end goal is a phone-style **keyboard simulator**: a mock chat screen on top, a tappable on-screen QWERTY keyboard on the bottom, and Khmer appearing live as keys are pressed. It should feel like using the real keyboard, so it can be demoed to testers and shown in TikToks.

IMPORTANT: This web version is a **demo / proving ground**, NOT the final product. The real product is a native Android IME (system keyboard) built later. Do not try to make this a real system keyboard — a browser cannot do that. See `ANDROID_NEXT.md` for the native path.

## Files provided in this folder

- `dictionary.json` — 438 romanized→Khmer entries (single words \+ a few phrases).  
- `converter.js` — the finished conversion engine. **Reuse it as-is.** Do not rewrite the conversion logic; just import `convert()`.

## The conversion engine (already built — just wire it in)

`converter.js` exports:

import { convert } from "./converter.js";

import dictionary from "./dictionary.json";

const { text, tokens } \= convert("jg tv pteas", dictionary);

// text  \=== "ចង់ទៅផ្ទះ"

// tokens \=== \[{text,type}, ...\]  type ∈ "match"|"guess"|"unknown"|"sep"

How it works (context, don't re-implement):

1. Longest-phrase dictionary match (up to 4 words).  
2. Glued-prefix peeling: `otniyeay` → អត់ \+ និយាយ (ot/jg/kom/mish/hx… prefixes).  
3. Letter-by-letter guess as last resort (marked low-confidence).  
4. Adjacent Khmer words are joined with **no space** (correct Khmer spacing).

## Build steps

1. Scaffold a Vite React project (`npm create vite@latest . -- --template react`).  
2. Drop `dictionary.json` and `converter.js` into `src/`.  
3. Build the UI described in `KEYBOARD_SPEC.md`.  
4. Run `npm run dev` and verify the acceptance tests below.  
5. Persistence: use **`localStorage`** (see note). NOT `window.storage`.

## Persistence note (critical)

Earlier this app ran as a Claude.ai artifact using `window.storage`, which does NOT exist in a normal browser. In this Vite app, custom words the user adds must be saved with `localStorage` under the key `khmer-custom-dict` as a JSON object, merged **on top of** `dictionary.json` at load time (custom words win).

const custom \= JSON.parse(localStorage.getItem("khmer-custom-dict") || "{}");

const dict \= { ...dictionary, ...custom };

## Acceptance tests (must all pass)

| Input | Expected output |
| :---- | :---- |
| `nis` | នេះ |
| `nham ey nv` | ញ៉ាំអីនៅ |
| `jg tv pteas` | ចង់ទៅផ្ទះ |
| `otniyeay` | អត់និយាយ |
| `komsl` | កុំស្រឡាញ់ |
| `mon sach` | សាច់មាន់ |
| `khmer` | ខ្មែរ |

## Design language (match the existing app)

- Dark background `#141312`, panels `#1D1B18`, borders `#2E2B26`.  
- Accent gold `#E8A93D`, main text `#F2EDE4`, muted text `#8a8578`.  
- Khmer font: `Noto Serif Khmer`. UI font: `Space Grotesk`.  
- Aesthetic ties to the "404 STUDIO" brand: black \+ gold, clean, modern.

## Deploy (after it runs locally)

Target **Cloudflare Pages** (user already uses Cloudflare):

- `npm run build` → outputs `dist/`.  
- Deploy `dist/` to Cloudflare Pages (via `npx wrangler pages deploy dist` or the dashboard). Confirm the live URL loads and converts correctly.

