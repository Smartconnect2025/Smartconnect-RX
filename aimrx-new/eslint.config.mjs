import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Add ignore patterns to exclude build outputs and generated files
  {
    ignores: [
      // Next.js build outputs
      ".next/**/*",
      "out/**/*",

      // Dependencies
      "node_modules/**/*",

      // Build and dist directories
      "dist/**/*",
      "build/**/*",

      // Environment and config files
      ".env*",

      // Cache directories
      ".turbo/**/*",
      ".swc/**/*",

      // Static exports
      "public/sw.js",
      "public/workbox-*.js",

      // TypeScript build info
      "*.tsbuildinfo",

      // Coverage reports
      "coverage/**/*",

      // Logs
      "*.log",
      "logs/**/*",

      // OS generated files
      ".DS_Store",
      "Thumbs.db",

      // IDE files
      ".vscode/**/*",
      ".idea/**/*",

      // Temporary files
      "tmp/**/*",
      "temp/**/*",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    rules: {
      "no-unused-vars": "off",
      // Don't allow unused variables unless they start with an underscore
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      // Disable the warning about using img elements instead of Next.js Image
      "@next/next/no-img-element": "off",
      // Disallow console.log, console.warn, console.debug - only allow console.error
      "no-console": ["warn", { allow: ["error"] }],
    },
  },
];

export default eslintConfig;
