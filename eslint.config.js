// Root lint config — exists ONLY to cover `shared/*.ts`, the security boundary (guard.ts/sanitize.ts,
// the tool validators) that both `ui` and `worker` import.
//
// Two ESLint-10 constraints force this file to live at the root:
//   1. A config's base path is its own directory and files ABOVE it are refused, so
//      `worker/eslint.config.js` can never reach `../shared` (`basePath` only scopes DOWNWARD).
//      Hence a root config + `basePath: "shared"`.
//   2. The typed-lint project SERVICE finds a project by walking up from each file; `shared/` has no
//      tsconfig above it. So pin the classic `project` to the worker's tsconfig, which includes
//      `../shared` — the same strict program the worker already compiles shared under.
//
// The ruleset is re-used from the worker (DRY — one strict ruleset, not two), but shared/ is a strict
// SUPERSET: the worker's local relaxations are deliberately NOT inherited (see STRICTER below), because
// they were justified by worker-specific context that does not apply to the security boundary.
// Run with the worker's binary: `worker/node_modules/.bin/eslint shared` (wired into worker's `lint`).
import workerConfig from "./worker/eslint.config.js";

// The worker relaxes these for its own test files' deliberately-loose `any` mocks. shared/ has no test
// dir, so inheriting the block is inert today — but it would silently disable the no-unsafe-* rules the
// day anyone adds `shared/test/`. Drop it rather than leave that trap armed.
const isWorkerTestOverride = (entry) =>
  Array.isArray(entry.files) && entry.files.includes("test/**/*.ts");

export default [
  ...workerConfig.filter((entry) => !isWorkerTestOverride(entry)).map((entry) =>
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
  ),
  // STRICTER than the worker: re-enable the rules the worker turns off. `no-non-null-assertion` is
  // off there because its guarded `!` indexed access is provably safe under noUncheckedIndexedAccess —
  // shared/ has zero `!`, so the relaxation buys nothing and only removes a guard-rail from the
  // boundary. Same reasoning for the stylistic `no-confusing-void-expression`.
  {
    basePath: "shared",
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-confusing-void-expression": "error",
    },
  },
];
