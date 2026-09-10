import { useEffect, useRef, type ReactNode } from "react";

// 024 P2: the bottom-sheet overlay hosting a run's results. Row 2 deliberately did not create this —
// it had no driver until row 1's category cards existed (YAGNI/AHA). Deliberately a plain fixed-position
// overlay + backdrop, not a native <dialog> or device-chrome mock: this is a web app, not a native app.
// Home.tsx passes the EXISTING error/announce/A2UISurface/TryAnotherRow/DevConsole block in as
// `children` (MOVED here, not duplicated) — this component owns only the shell: open/close, the
// backdrop, focus handling, and a Stop affordance (the Hero's own Stop button sits behind the backdrop
// while a run streams, so the overlay would otherwise make it unreachable).
//
// Closing never aborts the run underneath — it only hides the sheet. `onStop` is separate and only
// invoked by an explicit tap, never by a passive close (backdrop click / Escape / ✕).
export function ResultSheet({
  open,
  onClose,
  isRunning,
  onStop,
  children,
}: {
  open: boolean;
  onClose: () => void;
  isRunning: boolean;
  onStop: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // aria-modal hides the background from assistive tech, so focus must follow into the sheet — land it
  // on the close control, the one action always present. Escape is a standard dismiss affordance too.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center">
      <button
        type="button"
        aria-label="Close results"
        onClick={onClose}
        className="absolute inset-0 bg-text/40 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search results"
        className="relative z-10 w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-surface border border-border rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] p-[var(--space-4)]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-text-muted">Results</span>
          <div className="flex items-center gap-2">
            {isRunning && (
              <button
                type="button"
                onClick={onStop}
                className="min-h-[44px] px-3 rounded border border-border-strong text-text-muted hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Stop
              </button>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close results"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded border border-border-strong text-text-muted hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
