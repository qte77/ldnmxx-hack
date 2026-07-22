import js from "@eslint/js";
import globals from "globals";
import regexp from "eslint-plugin-regexp";
import security from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

// A CURATED unicorn subset (not the ~100-rule recommended set): high-signal, auto-fixable, low-noise
// modernisation rules only. The opinionated/churny ones (no-null, prevent-abbreviations, no-array-reduce,
// filename-case, no-array-for-each, …) are deliberately excluded.
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

// Worker/shared lint — mirrors ui/eslint.config.js (strictTypeChecked + stylisticTypeChecked +
// sonarjs) but node-only, no React. These are the security-critical request-path files.
export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      security.configs.recommended,
      regexp.configs["flat/recommended"],
    ],
    files: ["**/*.ts"],
    // Fail on a stale/unnecessary `eslint-disable` (so the reviewed exceptions we add stay honest).
    linterOptions: { reportUnusedDisableDirectives: "error" },
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { sonarjs, unicorn },
    rules: {
      ...UNICORN_RULES,
      // Provably-safe indexed access uses guarded `!` (the noUncheckedIndexedAccess pass).
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      complexity: ["error", 12],
      "sonarjs/cognitive-complexity": ["error", 15],
      // eslint-plugin-security's object-injection rule flags EVERY computed member access — here that is
      // guarded, format-validated index access (e.g. `postcodes[normalisePostcode(...)]`) over
      // noUncheckedIndexedAccess maps, not untrusted injection. Off per the plugin's own noise guidance;
      // the meaningful security rules (unsafe-regex, non-literal-fs/require/eval, child-process, …) stay on.
      "security/detect-object-injection": "off",
    },
  },
  // Test files use deliberately loose `any` mocks (fetch / env / AI stubs). Relax the type-aware
  // rules that only fire on that intentional looseness; production src stays fully strict.
  {
    files: ["test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      // Tests read local fixture files (usecases/*.json) by a non-literal path — controlled input, not
      // an fs-injection risk. The rule stays on for production src (which does no fs at all).
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  // Disable type-aware rules on plain JS config files (e.g. eslint.config.js itself).
  { files: ["**/*.js"], extends: [tseslint.configs.disableTypeChecked] },
);
