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
  label = "Search results",
  children,
}: {
  open: boolean;
  onClose: () => void;
  isRunning: boolean;
  onStop: () => void;
  // 024 P2 fix: a live region only announces a CHANGE — content already present when the region first
  // mounts is generally not announced (most screen-reader/browser combos). On a category-card tap the
  // sheet mounts WITH `activeTitle` already known, so the moved aria-live "Showing: …" paragraph inside
  // `children` never fires (it only worked for the hero-search path, where the sheet mounts empty and
  // USECASE_RESOLVED changes the text afterwards). The dialog's own accessible NAME is announced when
  // focus lands on it/its close button regardless of mount timing, so Home passes the same "Showing:
  // …" text here instead of relying solely on the inner live region.
  label?: string;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // aria-modal hides the background from assistive tech, so focus must follow into the sheet — land it
  // on the close control, the one action always present.
  // 024 P2 fix: split from the Escape-key effect below and keyed on `open` ALONE (not `onClose` too).
  // Home passes `onClose={() => setDismissed(true)}` — a fresh arrow every render — and Home re-renders
  // on every streamed SSE frame (setEventLog per dispatched event). A single combined effect keyed on
  // both would re-run (and re-focus the ✕ button) on every one of those renders while a run streams,
  // yanking focus away from wherever the user — keyboard or AT — had moved it (Stop, a result link…).
  // Keying on `open` alone runs this only on the false→true open transition, exactly once per open.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Escape is a standard dismiss affordance — this one DOES need the latest `onClose`, but re-adding a
  // window listener on every render (harmless — it can't steal focus) is a fair price for that.
  useEffect(() => {
    if (!open) return;
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
        // 024 P2 fix: --color-text is near-white in dark mode, so a text-tinted scrim would invert into
        // a LIGHT overlay on a dark UI — bg-black/40 darkens correctly in both schemes.
        className="absolute inset-0 bg-black/40 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative z-10 w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-surface border border-border rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] p-[var(--space-4)]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-text-muted">{label}</span>
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
