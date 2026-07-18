import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Self-host the brand font (Inter 400/700, latin subset only) via @fontsource — public npm, no private
// registry. Without these @font-face rules the --font-sans stack silently falls back to system fonts.
// Latin-only: civic UI is English; the extra subsets (cyrillic/greek/vietnamese/latin-ext) never paint.
// JetBrains Mono is dropped entirely — its sole user is the dev-only EventStream, which falls back to the
// system-mono stack in tokens.css.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-700.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
