# AGENTS.md

Instructions for AI coding agents working in this  
repository. Human contributors are welcome to read this too.

These rules are **binding**. If a change would break one of them, stop and
propose an ADR instead (see [docs/adr/000-documentation.md](./docs/adr/000-documentation.md)).

---

## 1. Mission and invariants

**private-notes** is a local-first notes app with on-device semantic search.

Three invariants that override every other rule:

1. **No backend, no telemetry.** The only network call ever allowed is the
  one-time download of the embedding model from the Hugging Face CDN, and
   it must happen inside the Web Worker. Never add `fetch`/`XHR`/WebSocket
   code that touches note content.
2. **Markdown on disk is the source of truth.** UI state, indexes, and
  caches are derivable from the files in the user's folder.
3. **Chromium-only by design.** Gate features through
  `getCompatibility()` in `src/lib/compatibility.ts`. Do not polyfill the
   File System Access API.

---

## 2. Language

- All code, identifiers, file names, comments, commit messages, PR
descriptions, documentation, and ADRs are written in **English**.
- This applies even when the human prompt is in another language: translate
ideas, never the artifacts.

---

## 3. Stack (single source of truth — no overlapping libraries)

Each concern has **one** chosen library. Do not add a second one. If you
believe a swap is justified, write an ADR before touching `package.json`.


| Concern                | Library                                                                    | Notes                                                                      |
| ---------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| UI runtime             | `react` 19 + `react-dom`                                                   | Function components only.                                                  |
| Build & dev server     | `vite` 6 + `@vitejs/plugin-react`                                          | No Webpack, no Rollup config sprawl.                                       |
| Language               | `typescript` 5 (strict)                                                    | `tsc -b` is the source of truth for types.                                 |
| Styling                | `tailwindcss` v4 via `@tailwindcss/vite`                                   | No CSS-in-JS, no Sass, no PostCSS plugins.                                 |
| Class merging          | local `cn()` in `src/lib/cn.ts` (wraps `clsx`)                             | Do not add `tailwind-merge` or `classnames`.                               |
| Fonts                  | `@fontsource-variable/geist` + `geist-mono`                                | No Google Fonts CDN at runtime.                                            |
| Rich text editor       | `@tiptap/`* (ProseMirror)                                                  | No CodeMirror, Lexical, Slate, Quill.                                      |
| Markdown parsing       | `marked`                                                                   | Only for MD → HTML. No `remark`/`unified`.                                 |
| Markdown serialization | hand-written in `src/lib/markdown/`                                        | Walks ProseMirror JSON. Do not introduce `turndown`.                       |
| Embeddings             | `@huggingface/transformers` in a Web Worker                                | No remote inference, no alternative ML libs.                               |
| Persistence            | File System Access API + IndexedDB (handle only)                           | Helpers in `src/lib/fs/`.                                                  |
| Testing                | `vitest` + `@testing-library/*` + `jsdom` + `fake-indexeddb`               | No Jest, Mocha, Cypress, Playwright.                                       |
| Linting                | `eslint` 9 flat config + `typescript-eslint` + `eslint-plugin-react-hooks` | No Prettier — formatting is governed by `.editorconfig` + ESLint defaults. |
| Package manager        | `pnpm` (pinned via `packageManager`, enable with `corepack enable`)        | Do not commit `package-lock.json` or `yarn.lock`.                          |


**Explicitly forbidden without an ADR:** Redux/Zustand/Jotai/Recoil,
`axios`/`ky`, `lodash`/`ramda`, Radix/MUI/Chakra/shadcn-ui, `date-fns`,
`zod`, server frameworks. The app is intentionally small — keep it that
way.

---

## 4. Design system

The visual language is a minimal, Vercel-inspired editor surface: lots of
whitespace, thin borders, no chrome, content first.

### 4.1 Tokens (the only colours and fonts you may use)

Defined in `src/styles.css` via `@theme` and overridden under
`html[data-theme="light"|"dark"]` (with `prefers-color-scheme` as fallback).
Always reference them with CSS variables — **never** hardcode hex values in
components:

```
--color-background      --color-foreground
--color-muted           --color-muted-foreground
--color-border          --color-ring
--color-accent          --color-accent-foreground
--color-danger
--font-sans (Geist)     --font-mono (Geist Mono)
```

If you need a new colour, add it as a token in both light and dark blocks
of `src/styles.css`. Do not introduce inline colours.

### 4.2 Hierarchy

- **Primitives** live in `src/ui/` (`Button`, `Input`, `Dialog`,
`ConfirmDialog`, `AppShell`, `Logo`, `ThemeToggle`). They wrap a single
HTML element, take `className`, and use `forwardRef` when applicable.
- **Compositions** live in `src/screens/` (e.g. `NotesList`,
`CommandPalette`, `SearchPanel`). They combine primitives and own
layout. They never import from `App.tsx`.
- **Editor-specific** UI lives in `src/editor/`.
- `App.tsx` is the only place that orchestrates vault lifecycle and wires
screens together.

### 4.3 Component conventions

- Buttons: use the `Button` primitive with `variant` ∈ {`primary`,
`secondary`, `ghost`} and `size` ∈ {`sm`, `md`}. Do not style raw
`<button>` elements.
- Inputs: use the `Input` primitive.
- Modals: use `Dialog` / `ConfirmDialog`. Do not add a modal library.
- Focus ring: every interactive element must show
`focus-visible:ring-2 ring-[var(--color-ring)]` with offset (the
primitives already do this — keep it that way).
- Radii: `rounded-md` for controls, `rounded-xl` for dialogs and cards.
- Spacing scale: stay on Tailwind's default scale (multiples of 4 px).
- Iconography: prefer text or inline SVG; do not import an icon library.

### 4.4 Type hierarchy

```
3xl semibold tracking-tight   ← page title / note title
xl  semibold                  ← section heading
sm  medium                    ← body / list item title
xs  uppercase tracking-wider  ← labels (use muted-foreground)
xs  muted-foreground          ← timestamps / meta
```

Body text uses `var(--font-sans)`; code uses `var(--font-mono)`. Long-form
note content goes through `.prose-like` (see `src/styles.css`).

### 4.5 Theme

Themes are switched via the `data-theme` attribute on `<html>` (see
`src/lib/theme.ts`). Anything dependent on the active theme must read CSS
variables, never `window.matchMedia` directly inside components.

---

## 5. Architecture

### 5.1 Layer boundaries (do not cross)

```
src/lib/**       pure logic, no JSX, no React imports
        └── may import from `src/lib/`** only
src/ui/**        primitives, may import from `src/lib/cn`
src/screens/**   compositions, may import `ui/`** and `lib/**`
src/editor/**    TipTap-specific UI + extensions
src/workers/**   runs off the main thread; no React, no DOM
src/App.tsx      the only place that wires vault, search, editor, screens
```

`lib/*` modules must remain framework-agnostic and unit-testable without a
DOM whenever possible.

### 5.2 Folder layout on disk

The vault folder is owned by the app and follows the layout described in
[README.md](./README.md) and [docs/architecture.md](./docs/architecture.md).
Any change to that layout requires an ADR and a bump of `SCHEMA_VERSION`
(or `SEMANTIC_SCHEMA_VERSION`) per
[ADR-008](./docs/adr/008-schema-compatibility.md).

### 5.3 Workers and async work

- All embedding work happens in a Web Worker (`src/workers/`). The main
thread must never call into `@huggingface/transformers` directly.
- Long-running tasks (reindex, bulk I/O) report progress through a single
`onProgress` callback so the UI stays responsive.
- Effects that fire async work must guard against unmount with a
`cancelled` flag (see `App.tsx` for the canonical pattern).

### 5.4 Permissions

File System Access permissions must be requested inside a user gesture via
`ensureReadWritePermission` (see `src/lib/fs/permissions.ts`). Background
code uses `hasReadWritePermission` to check, never to prompt.

---

## 6. TypeScript

- `strict` is on. Do not introduce `any`; use `unknown` and narrow.
- Prefer `interface` for object shapes, `type` for unions and aliases.
- Annotate non-trivial function return types.
- No `// @ts-ignore`. Use `// @ts-expect-error` with a comment when truly
unavoidable (e.g. simulating a missing global in a test).
- File System Access globals are declared in `src/lib/fs/fs.d.ts`. Add to
that file rather than re-declaring inline.

---

## 7. React patterns

- Functional components, named exports, one component per file.
- File naming:
  - Components: `PascalCase.tsx` (e.g. `NoteHeader.tsx`).
  - Library modules: `kebab-case.ts` (e.g. `vault-handle-store.ts`).
- Use `useCallback`/`useMemo` only when there is a concrete reason
(referential stability in effect deps, expensive computation, memoized
child). Don't blanket-wrap handlers.
- Lift state to the lowest common ancestor; do not introduce a global
store. If you find yourself prop-drilling more than two levels, ask
whether the screen boundary is wrong.
- Server-rendering is not a goal; do not add SSR-safety code.

---

## 8. Comments

- Explain **intent and trade-offs**, not what the code does.
- The patterns in `src/lib/fs/permissions.ts`, `vault-handle-store.ts`,
and `src/lib/theme.ts` are the reference for tone and length.
- Never narrate ("Increment the counter"). Never describe the diff in a
comment.

---

## 9. Testing

- Run `pnpm test` and `pnpm typecheck` before considering a change done.
For UI changes, also run `pnpm lint`.
- Co-locate tests in `__tests__/` next to the module they cover, named
`*.test.ts(x)`.
- Mock the File System Access API with `src/test/fakeFs.ts`. Tests that
touch IndexedDB import `fake-indexeddb/auto` at the top.
- Cover the new behaviour with at least one test. Prefer testing the
public surface of a `lib/` module over private helpers.

---

## 10. Documentation

- The user-facing README is `README.md`. Engineering docs live in `docs/`.
- For any non-trivial architectural decision, add an ADR under
`docs/adr/NNN-short-title.md` following the template in
[ADR-000](./docs/adr/000-documentation.md). Cross-link it from
`docs/architecture.md` and `docs/README.md`.
- Update the relevant ADR when you change behaviour it documented;
superseded ADRs keep the file with a pointer to the replacement.

---

## 11. Workflow

- Use `pnpm` (Corepack). Do not check in `node_modules`, `dist`,
`coverage`, `.pnpm-store`, or `*.tsbuildinfo` — they are already
gitignored.
- Keep diffs small and focused. One concern per commit.
- Commit messages are short, imperative, English, and reference an ADR or
file path when relevant (e.g. `fs: persist vault handle in IndexedDB`).
- Before opening a PR, ensure: typecheck passes, tests pass, lint passes,
no new dependencies that overlap with section 3, and any architectural
change has an ADR.

---

## 12. When unsure

1. Read the relevant ADR in `docs/adr/`.
2. Look at the closest existing module for tone and shape.
3. Prefer deleting code over adding it. Prefer a primitive over a library.
4. If the change is still ambiguous, draft an ADR and ask before
  implementing.

