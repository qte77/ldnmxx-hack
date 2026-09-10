import { useState } from "react";
import { TabBar, type ScreenId } from "./TabBar";
import { Home } from "../screens/Home";
import { Settings } from "../screens/Settings";

// 024 P0.2: the app-shell replacing the old single-page Dashboard. Screen switching is DELIBERATELY
// in-memory state, never a path route — ui/public/404.html disables the Pages SPA fallback (#178), so
// a path like /settings would hard-404 on a reload or deep link.
export function AppShell() {
  const [screen, setScreen] = useState<ScreenId>("home");
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto w-full">
      <div className="flex-1 px-4">{screen === "home" ? <Home /> : <Settings />}</div>
      <TabBar active={screen} onSelect={setScreen} />
    </div>
  );
}
