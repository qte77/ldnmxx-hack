export type ScreenId = "home" | "settings";

const TABS: { id: ScreenId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "settings", label: "Settings" },
];

// 024 P0.2: the design's bottom tab bar. Deliberately simple flow layout (not position: fixed) —
// sticky/pinned polish belongs to whichever later row settles Home's final content height.
export function TabBar({ active, onSelect }: { active: ScreenId; onSelect: (id: ScreenId) => void }) {
  return (
    <nav aria-label="Primary" className="flex border-t border-border bg-surface">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          aria-current={active === t.id ? "page" : undefined}
          className={`flex-1 min-h-[44px] py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            active === t.id ? "text-primary" : "text-text-muted"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
