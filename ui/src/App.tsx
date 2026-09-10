import { A2UISurfaceProvider } from "./A2UISurface";
import { AppShell } from "./shell/AppShell";

export function App() {
  return (
    <A2UISurfaceProvider>
      <AppShell />
    </A2UISurfaceProvider>
  );
}
