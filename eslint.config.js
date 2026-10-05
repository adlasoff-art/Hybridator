import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist",
      "**/.output",
      "**/.vinxi",
      "**/node_modules",
      "apps/web-pwa/src/routeTree.gen.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["packages/**/*.{ts,tsx}", "apps/web-pwa/**/*.{ts,tsx}", "scripts/**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      // shadcn / providers export helpers alongside components — disable to keep CI zero-warning
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Pure TS packages: no React hooks rules
  {
    files: ["packages/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  eslintPluginPrettier,
);
