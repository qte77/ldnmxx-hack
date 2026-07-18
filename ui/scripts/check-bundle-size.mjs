// Bundle-size guard (plan 014 · P5). Fails if the render-critical gzip payload
// regresses past the committed ceilings, protecting the P1-P3 perf wins. Sums the
// gzip size of every emitted JS / CSS asset (so future code-split chunks still count).
//
// Run after `vite build`:  node scripts/check-bundle-size.mjs
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const ASSETS = fileURLToPath(new URL("../dist/assets/", import.meta.url));

// Gzip byte ceilings for the entry bundles: current size + headroom. Raise
// deliberately (in the same PR) when an intentional feature grows the bundle.
const LIMITS = { ".js": 150_000, ".css": 8_000 };

if (!existsSync(ASSETS)) {
  console.error(`no build output at ${ASSETS} — run \`npm run build\` first`);
  process.exit(1);
}

const gzipTotal = (ext) =>
  readdirSync(ASSETS)
    .filter((f) => f.endsWith(ext) && statSync(join(ASSETS, f)).isFile())
    .reduce((sum, f) => sum + gzipSync(readFileSync(join(ASSETS, f))).length, 0);

let failed = false;
for (const [ext, limit] of Object.entries(LIMITS)) {
  const got = gzipTotal(ext);
  const ok = got <= limit;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"} ${ext.slice(1).toUpperCase().padEnd(3)} gzip ${got} B (limit ${limit} B)`);
}

if (failed) {
  console.error("\nbundle-size guard failed (plan 014 · P5) — reduce the payload or raise the limit intentionally");
  process.exit(1);
}
console.log("bundle-size guard passed");
