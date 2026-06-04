import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "core"),
      "@features": path.resolve(__dirname, "features"),
      "@types": path.resolve(__dirname, "types"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
