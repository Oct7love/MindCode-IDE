import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "dist/**",
      "release/**",
      "node_modules/**",
      "*.config.js",
      "*.config.ts",
    ],
  },

  // Base: all TS files
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Shared rules for all TS files
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
          allowConciseArrowFunctionExpressionsStartingWithVoid: true,
        },
      ],
      // Allow intentional empty catch blocks; still flag other empty blocks.
      // (Replaces the previous no-op `no-empty-catch` typo rule.)
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-useless-catch": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Node globals for main/core/shared (main-process or shared/isomorphic code
  // that may be bundled into the main process).
  {
    files: ["src/main/**/*.ts", "src/core/**/*.ts", "src/shared/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // "No DOM in main process" — scoped to src/main/** only.
  // src/core/** is intentionally excluded: several core modules are isomorphic
  // and run inside the renderer (e.g. lsp/client, github/client access
  // window.mindcode) or feature-detect `window`. Enforcing "core must not
  // depend on the renderer global" is tracked as an M3 architecture task
  // (docs/refactor/03_REFACTOR_ROADMAP.md), not a lint gate here.
  {
    files: ["src/main/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "document", message: "No DOM in main process." },
        { name: "window", message: "No DOM in main process." },
      ],
    },
  },

  // Renderer process (Browser/React)
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  }
);
