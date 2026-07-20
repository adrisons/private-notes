import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * Barrel imports like `../domain` are the common style here, and a bare
 * `**​/domain/**` glob does NOT match them — it requires a path segment after
 * the folder. Every layer group must therefore list both forms, or the
 * boundary silently stops being enforced.
 */
const layerGroup = (...folders) =>
  folders.flatMap((folder) => [`**/${folder}`, `**/${folder}/**`]);

const infraImportPattern = {
  group: layerGroup("infrastructure"),
  message:
    "Import infrastructure only through application/composition/ (or from within infrastructure/).",
};

const domainImportPattern = {
  group: layerGroup("domain"),
  message:
    "Presentation consumes application/view-models, not domain types directly.",
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
              group: layerGroup(
                "application",
                "infrastructure",
                "screens",
                "ui",
                "editor",
              ),
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
    // Primitives: presentation vocabulary comes from application/view-models,
    // never from the model or persistence.
    files: ["src/ui/**/*.{ts,tsx}"],
    ignores: ["src/ui/**/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [infraImportPattern, domainImportPattern] }],
    },
  },
  {
    files: ["src/screens/**/*.{ts,tsx}"],
    ignores: ["src/screens/**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            infraImportPattern,
            domainImportPattern,
            {
              group: layerGroup("lib/fs", "lib/notes", "lib/search", "lib/attachments", "lib/markdown"),
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
