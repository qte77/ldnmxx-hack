import { useState } from "react";

// Reused from qte77/agenthud-agui-a2ui: the A2UI standard-catalog viewer. `rendered` marks the types
// the live catalog (catalog.ts) actually draws on the surface via the "Render live" button.
interface CatalogEntry {
  name: string;
  description: string;
  rendered: boolean;
}

const CATALOG: CatalogEntry[] = [
  { name: "Text", description: "Text with usageHint (h1–h5, body, caption)", rendered: true },
  { name: "Card", description: "Elevated container for one child", rendered: true },
  { name: "Column", description: "Vertical layout of children", rendered: true },
  { name: "Row", description: "Horizontal layout of children", rendered: true },
  { name: "Divider", description: "Visual separator", rendered: true },
  { name: "Button", description: "Clickable action trigger", rendered: true },
  { name: "CheckBox", description: "Boolean toggle with label", rendered: true },
  { name: "Slider", description: "Numeric range input", rendered: true },
  { name: "Image", description: "Image from a URL token", rendered: false },
  { name: "List", description: "Ordered items with title + child", rendered: false },
  { name: "Tabs", description: "Tabbed content navigation", rendered: false },
  { name: "Icon", description: "Predefined icon by name", rendered: false },
  { name: "TextField", description: "Text input with label", rendered: false },
  { name: "Slider / Modal / Video / AudioPlayer / …", description: "Rest of the standard catalog", rendered: false },
];

const LINKS = [
  { label: "A2UI protocol", url: "https://github.com/google/A2UI" },
  { label: "AG-UI protocol", url: "https://docs.ag-ui.com/introduction" },
];

export function CatalogViewer({ onRenderLive }: { onRenderLive: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="A2UI standard component catalog"
        className="px-2 py-1 rounded border border-border text-sm text-text-muted hover:border-primary"
      >
        ◫ Catalog
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col border border-border">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-primary">A2UI standard component catalog</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-text-muted hover:text-text text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3 flex-1 space-y-3">
              <p className="text-xs text-text-muted">
                The agent selects only from this pre-approved catalog at runtime — declarative JSON
                referencing these types, no arbitrary code.
              </p>
              <button
                type="button"
                onClick={() => {
                  onRenderLive();
                  setOpen(false);
                }}
                className="w-full px-3 py-2 rounded bg-primary text-primary-on text-sm font-medium"
              >
                ▶ Render the highlighted types live on the surface
              </button>
              <div className="space-y-1">
                {CATALOG.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 py-1">
                    <span
                      className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                        c.rendered ? "bg-primary/20 text-primary font-semibold" : "bg-bg text-text-muted"
                      }`}
                    >
                      {c.name}
                    </span>
                    <span className="text-xs text-text-muted">{c.description}</span>
                    {c.rendered && (
                      <span className="text-[10px] text-data-positive ml-auto shrink-0">rendered</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 flex gap-3">
                {LINKS.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    {l.label} &rarr;
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
