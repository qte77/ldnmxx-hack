import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import regexp from "eslint-plugin-regexp";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

// A CURATED unicorn subset (mirrors worker/eslint.config.js): high-signal, auto-fixable, low-noise
// modernisation rules only — NOT the ~100-rule recommended set. Opinionated/churny rules are excluded.
const UNICORN_RULES = {
  "unicorn/prefer-node-protocol": "error",
  "unicorn/prefer-string-slice": "error",
  "unicorn/prefer-string-starts-ends-with": "error",
  "unicorn/prefer-string-replace-all": "error",
  "unicorn/prefer-array-some": "error",
  "unicorn/prefer-array-find": "error",
  "unicorn/prefer-array-flat-map": "error",
  "unicorn/prefer-includes": "error",
  "unicorn/prefer-number-properties": "error",
  "unicorn/prefer-optional-catch-binding": "error",
  "unicorn/prefer-date-now": "error",
  "unicorn/no-instanceof-array": "error",
  "unicorn/no-useless-spread": "error",
  "unicorn/throw-new-error": "error",
};

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      regexp.configs["flat/recommended"],
    ],
    files: ["**/*.{ts,tsx}"],
    // Fail on a stale/unnecessary `eslint-disable` so the reviewed disables stay honest.
    linterOptions: { reportUnusedDisableDirectives: "error" },
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: { allowDefaultProject: ["vite.config.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      sonarjs,
      unicorn,
    },
    rules: {
      ...UNICORN_RULES,
      ...reactHooks.configs.recommended.rules,
      // React-Compiler advisory rules (react-hooks v7): keep as warnings — they flag
      // intentional latest-ref / recursive-timer patterns in the tested replay engine.
      // The classic rules (rules-of-hooks, exhaustive-deps) stay as errors.
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Catch the "Complex Method" class locally + in CI (CodeFactor uses similar metrics).
      // The repo uses deliberate, guarded `!` for provably-safe indexed access (noUncheckedIndexedAccess pass).
      "@typescript-eslint/no-non-null-assertion": "off",
      // Idiomatic React event handlers like `onClick={() => setX(v)}` return void expressions.
      "@typescript-eslint/no-confusing-void-expression": "off",
      complexity: ["error", 12],
      "sonarjs/cognitive-complexity": ["error", 15],
      // Design-adherence nudges (arc 024, ported from the Claude Design system's own lint config —
      // see docs/plans/024-app-shell-redesign.md). "warn", not "error": pre-existing literal values
      // (44px hit targets, --radius-card's 14px) are legitimate one-offs, not violations to force-fix.
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "Raw hex colour — use a token via var(--color-*) instead.",
        },
        {
          selector: "Literal[value=/\\b\\d+px\\b/]",
          message: "Raw px value — use a spacing/radius token via var(--space-*|--radius-*) instead.",
        },
        {
          selector:
            "Literal[value=/font-family\\s*:\\s*(?!['\"]?(?:Cormorant Garamond|Lora|JetBrains Mono))/i]",
          message: "Font not in the design system. Available: Cormorant Garamond, Lora, JetBrains Mono.",
        },
      ],
    },
  },
  // Disable type-aware rules on plain JS config files (e.g. eslint.config.js itself).
  { files: ["**/*.js"], extends: [tseslint.configs.disableTypeChecked] },
);
