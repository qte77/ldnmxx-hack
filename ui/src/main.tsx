import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Self-host the fonts (no CDN — the CSP is script/style/font-src 'self') via @fontsource — public npm,
// no private registry. Without these @font-face rules the --font-sans/--font-mono stacks silently fall
// back to system fonts. Latin-only: civic UI is English; the extra subsets (cyrillic/greek/vietnamese/
// latin-ext) never paint. One weight each of Inter (400/700) and JetBrains Mono (400) — 017 P1 re-added
// mono because fo's system sets numerals in it, and the app now uses it for the numerals a visitor
// actually reads (the footer version, the dev event stream).
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
