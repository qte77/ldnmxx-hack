import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Self-host the fonts (no CDN — the CSP is script/style/font-src 'self') via @fontsource — public npm,
// no private registry. Without these @font-face rules the --font-heading/--font-body/--font-mono
// stacks silently fall back to system fonts. Latin-only: civic UI is English; the extra subsets
// (cyrillic/greek/vietnamese/latin-ext) never paint. Arc 024 replaces Inter with the design's serif
// pairing: Cormorant Garamond at 600 (the ONLY weight the design uses it at — headings, card/dialog
// titles, and button labels all key off --font-heading-weight) and Lora at 400 (body prose) + 600
// (segmented-control labels, section headers). JetBrains Mono stays for the dev console's numerals
// (footer version, event stream) — untouched by this arc.
import "@fontsource/cormorant-garamond/latin-600.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-600.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
