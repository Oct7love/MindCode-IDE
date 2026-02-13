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
      "no-empty-catch": "off",
      "no-useless-catch": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Main process (Node/CommonJS)
  {
    files: ["src/main/**/*.ts", "src/core/**/*.ts", "src/shared/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
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
