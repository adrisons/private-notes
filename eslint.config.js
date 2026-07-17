import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const infraImportPattern = {
  group: ["**/infrastructure/**"],
  message:
    "Import infrastructure only through application/composition/ (or from within infrastructure/).",
};

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/application/**", "**/infrastructure/**", "**/screens/**", "**/ui/**", "**/editor/**"],
              message: "Domain must not import outer layers.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.{ts,tsx}"],
    ignores: [
      "src/application/composition/**",
      "src/application/**/__tests__/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [infraImportPattern],
        },
      ],
    },
  },
  {
    files: ["src/screens/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            infraImportPattern,
            {
              group: ["**/domain/**"],
              message: "Screens consume view models, not domain types.",
            },
            {
              group: ["**/infrastructure/**"],
              message: "Screens must not import persistence modules.",
            },
            {
              group: ["**/lib/fs/**", "**/lib/notes/**", "**/lib/search/**", "**/lib/attachments/**", "**/lib/markdown/**"],
              message: "Legacy lib I/O paths are forbidden in screens.",
            },
          ],
          paths: [
            {
              name: "../lib/fs/types",
              message: "Use application/view-models instead of persistence DTOs.",
            },
          ],
        },
      ],
    },
  },
);
