import { Suspense, lazy, useState } from "react";
import { TabBar, type ScreenId } from "./TabBar";
import { Home } from "../screens/Home";

// Perf: Settings isn't needed on first paint (Home is always the entry screen) — deferring its own
// code (segmented controls, the borough select, the about block) shrinks the initial JS chunk. Named
// export -> lazy() needs a `default`, hence the .then() wrapper.
const Settings = lazy(() =>
  import("../screens/Settings").then((m) => ({ default: m.Settings }))
);

// 024 P0.2: the app-shell replacing the old single-page Dashboard. Screen switching is DELIBERATELY
// in-memory state, never a path route — ui/public/404.html disables the Pages SPA fallback (#178), so
// a path like /settings would hard-404 on a reload or deep link.
export function AppShell() {
  const [screen, setScreen] = useState<ScreenId>("home");
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto w-full">
      <div className="flex-1 px-4">
        {screen === "home" ? (
          <Home />
        ) : (
          // Fallback is empty (not a spinner): the Settings chunk is tiny and same-origin, so the gap
          // is imperceptible — a flashed loading state would be more distracting than the wait itself.
          <Suspense fallback={null}>
            <Settings />
          </Suspense>
        )}
      </div>
      <TabBar active={screen} onSelect={setScreen} />
    </div>
  );
}
