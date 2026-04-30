import { defineConfig, globalIgnores } from "eslint/config"
import nextPlugin from "@next/eslint-plugin-next"
import reactPlugin from "eslint-plugin-react"
import reactHooksPlugin from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

export default defineConfig([
  globalIgnores([
    "node_modules/",
    ".next/",
    "out/",
    "programs/",
    "programs-loan/",
    "whitelabel-starter/",
    "lib/idl/",
  ]),

  // TypeScript
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/ban-ts-comment": "warn",
    },
  },

  // React
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactHooksPlugin.configs["recommended-latest"].rules,
      "react/no-unescaped-entities": "off",
      // React Compiler rules — downgrade to warnings for gradual adoption
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
    settings: { react: { version: "detect" } },
  },

  // Next.js
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    extends: [nextPlugin.configs["core-web-vitals"]],
    rules: {
      "@next/next/no-img-element": "warn",
    },
  },
])
