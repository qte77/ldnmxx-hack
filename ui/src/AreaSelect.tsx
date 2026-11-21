// The "Your area" borough <select> — a default-location ANCHOR for Home's search (shared/places.ts's
// resolvePlace), never a within-borough filter (prefs.ts's readBorough/writeBorough doc comment).
// Moved out of Settings.tsx (#353) so Home can offer the same control in place: both screens read and
// write the one stored value through prefs.ts, so there is no second copy of the area to drift. A
// change only stores the value; it never navigates or submits (WCAG 3.2.2 On Input).
import type { ReactNode } from "react";
import { boroughLabels } from "./boroughs";

const BOROUGHS = boroughLabels();

export function AreaSelect({
  id,
  value,
  onChange,
  hint,
  hintId,
  className,
}: {
  id: string;
  value: string | null;
  onChange: (v: string | null) => void;
  hint?: ReactNode;
  hintId?: string;
  className: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold text-text mb-2">
        Your area
      </label>
      <select
        id={id}
        value={value ?? ""}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => {
          onChange(e.target.value === "" ? null : e.target.value);
        }}
        className="min-h-[44px] w-full px-3 rounded border border-border-strong bg-bg text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <option value="">Not set</option>
        {BOROUGHS.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
