// Root lint config — exists ONLY to cover `shared/*.ts`, the security boundary (guard.ts/sanitize.ts)
// that both `ui` and `worker` import and that was previously unlinted.
//
// Two ESLint-10 constraints force this file to live at the root:
//   1. A config's base path is its own directory and files ABOVE it are refused, so
//      `worker/eslint.config.js` can never reach `../shared`. Hence a root config + `basePath: "shared"`.
//   2. The typed-lint project SERVICE finds a project by walking up from each file; `shared/` has no
//      tsconfig above it. So pin the classic `project` to the worker's tsconfig, which now includes
//      `../shared` — the same strict program the worker already compiles shared under.
//
// The ruleset itself is re-used from the worker (DRY — one strict ruleset, not two).
// Run with the worker's binary: `worker/node_modules/.bin/eslint shared`.
import workerConfig from "./worker/eslint.config.js";

export default workerConfig.map((entry) =>
  entry.languageOptions?.parserOptions
    ? {
        ...entry,
        basePath: "shared",
        languageOptions: {
          ...entry.languageOptions,
          parserOptions: {
            projectService: false,
            project: ["./worker/tsconfig.json"],
            tsconfigRootDir: import.meta.dirname,
          },
        },
      }
    : { ...entry, basePath: "shared" },
);
