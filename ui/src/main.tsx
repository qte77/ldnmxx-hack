import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Self-host the brand fonts (Inter + JetBrains Mono, 400/700) via @fontsource — public npm, no private
// registry. Without these @font-face rules the --font-* stacks silently fell back to system fonts.
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
