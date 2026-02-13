/**
 * Vitest Configuration
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", ".git"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "dist", "src/test", "**/*.d.ts", "**/*.config.*"],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@components": path.resolve(__dirname, "./src/renderer/components"),
      "@services": path.resolve(__dirname, "./src/renderer/services"),
      "@hooks": path.resolve(__dirname, "./src/renderer/hooks"),
      "@stores": path.resolve(__dirname, "./src/renderer/stores"),
      "@core": path.resolve(__dirname, "./src/core"),
      // monaco-editor 无 main 入口，测试环境直接指向 ESM 入口
      "monaco-editor": path.resolve(
        __dirname,
        "./node_modules/monaco-editor/esm/vs/editor/editor.main.js",
      ),
    },
  },
});
