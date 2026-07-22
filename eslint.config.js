import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", ".vite/**", "android/**"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react/jsx-uses-react": "off",
      "react/jsx-uses-vars": "error",
      "react/react-in-jsx-scope": "off",
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^(_|React$)",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-undef": "error",
      "no-useless-escape": "warn",
      "no-prototype-builtins": "off",
    },
  },
  {
    files: ["src/**/*.test.{js,jsx}", "tests/**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  {
    files: [
      "vite.config.js",
      "vitest.config.js",
      "eslint.config.js",
      "postcss.config.js",
      "tailwind.config.js",
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
