# Design criteria

The written criteria behind every UI decision in **private-notes**. This
document explains *why* and *what*; the *how much* lives only in
`src/styles/design-tokens.css`. Shared motion and interaction utilities live
in `src/styles.css` (see [§8](#8-css-utilities)).

**Binding for agents.** Read this before touching anything under `src/ui/`,
`src/screens/`, `src/editor/`, or `src/styles.css`. Two rules override
personal taste:

1. **No hardcoded values.** Colors, radii, durations, easings, shadows and
   spacing come from tokens. A literal hex, `200ms`, `ease-in-out` or
   `border-radius: 6px` in a component is a bug.
2. **Never say "smooth".** Every motion spec names an exact curve token and
   an exact duration token. Reviews reject vague motion.

---

## 1. Product character

A local-first notes app. The interface is a **quiet tool that reacts**: it
stays out of the way while writing, and answers immediately and visibly when
touched. Not a dashboard, not a toy. Density closer to Linear, warmth closer
to Notion.

Five adjectives to resolve arguments: **calm, tactile, legible, cute,
personal.**

"Cute" here is a discipline, not a licence for stickers. It means warm
off-white paper instead of clinical white, a coral accent instead of
corporate blue, generous rounding, and small hand-made gestures that reward
attention. It never means neon, confetti, or a mascot. The test: an
animation should make someone smile the third time they see it and not
annoy them the thirtieth. If it fails that, it is decoration — cut it.

"Personal" means the app does not feel template-generated: **actions have
their own gestures** ([§5.4](#54-signature-gestures)) and surfaces have real
depth ([§5.5](#55-depth)).

### 1.1 Brand tone — how the app talks

The app is a **calm, competent friend who respects your privacy**, not a
brand with a personality disorder. Every string in the UI follows these:

- **Second person, present tense, plain words.** "Choose a folder", not
  "Folder selection required". "Search understands meaning", not "Leverage
  semantic retrieval".
- **Short.** A label is 1–3 words, a description is one sentence. If a
  sentence needs a comma splice, split it.
- **Never cutesy in words.** The charm lives in motion and color, not in
  copy. Banned: "Oops!", "Whoops", "Uh-oh", "Yay", exclamation marks,
  emoji in UI strings, and anything that jokes about the user's data.
- **Errors state the fact, then the fix**, and never blame the user:
  "The search index could not be updated. Your notes are still saved."
  followed by what to try. No stack traces, no error codes in the sentence.
- **Privacy is stated, not sold.** "Nothing leaves this device" is a fact
  we can repeat plainly; it never becomes a badge or a slogan.
- **Empty states invite one action**, name it, and stop.
- **Sentence case everywhere.** Only `UPPERCASE` for the small section
  labels in the sidebar, which are structural, not verbal.

### 1.2 Visual identity

- **Wordmark**: `private-notes`, lowercase, in Geist Mono, preceded by a
  short accent-colored vertical bar. Lowercase and monospace say
  "local file, plain text"; the coral bar is the only brand flourish. Never
  set the name in title case or in the sans face.
- **Type**: Geist Variable for everything human-readable, Geist Mono for
  the wordmark, keyboard hints, and code. Two families, no third.
- **Icons**: line icons only — 1.5–2px stroke, round caps and joins,
  `currentColor`, on a 24px grid. **Emoji are never UI affordances.** They
  are user content; the moment one is used as a button icon the interface
  reads as a prototype.
- **Color**: one chromatic accent (coral) in the chrome. Chip colors
  ([§3.3](#33-chip-colors-future)) belong to user content — tags, matches,
  badges — never to chrome. If a screen has two competing chromatic colors,
  one of them is wrong.
- **Imagery**: no illustrations, no mascots, no stock photography. The only
  images in the product are the ones the user puts in their notes. Depth
  and warmth come from light and motion ([§5.5](#55-depth)).
- **Corners are never sharp** on interactive surfaces ([§6](#6-elevation-radius-and-typography)).

---

## 2. Design principles

We borrow selectively: **Notion**'s warm paper and playful hover reactions;
**Rive**'s whole-region hit targets and press feedback; **Spotify**'s visible
accessibility (labels, contrast, large targets, mobile panel collapse);
**Molly Fountain**'s one-gesture-per-action authorship; **Firefly Tutors**'s
layered depth and offset button bodies; **Vercel**'s Geist typography, hairline
borders, and restraint — but never its near-black dark canvas. We explicitly
reject dashboard density, mascot illustration, saturated arcade palettes, and
marketing-page chrome.

---

## 3. Color

### 3.1 Token roles

Colors are declared as **roles**, never as hues. Canonical names (used in
components as `var(--role)`) live in `design-tokens.css`:

| Role | Purpose |
|---|---|
| `--canvas` | App background, lowest layer |
| `--surface` | Panels on the canvas (sidebar, note list) |
| `--surface-raised` | Cards, popovers, selected note row |
| `--surface-sunken` | Recessed wells |
| `--foreground` / `--foreground-muted` / `--foreground-subtle` | Three text weights, no more |
| `--border` / `--border-strong` | Hairline and region dividers |
| `--accent` / `--accent-hover` / `--accent-foreground` / `--accent-soft` | Primary action pair and tinted fills |
| `--ring` | Focus only. Never decorative |
| `--danger` / `--danger-foreground` / `--danger-soft` / `--success` / `--warning` | Status only |
| `--shadow-rest` / `--shadow-hover` / `--shadow-overlay` / `--shadow-offset` | Elevation stacks |
| `--backdrop` / `--ambient-warm` / `--ambient-cool` / `--glow` | Overlays and ambient depth |

Light mode is **warm off-white paper**, Notion-style: the canvas is the
lowest warm neutral, the sidebar sits one step down, and raised surfaces
climb toward white. Neutrals are warm (a touch of red/yellow in the gray),
never blue-gray — this is most of where "cute" comes from.

The accent is a **warm coral**, not corporate blue: personal, friendly, and
able to carry `--accent-foreground` at ≥ 4.5:1. It is the only chromatic
color in the chrome.

### 3.2 Dark mode

Dark mode inverts elevation — surfaces go **lighter** as they rise, and the
whole scale is lifted off pure black. Each adjacent surface step must be
visually distinguishable without a border. Foreground text is soft, never pure
white, to cut halation. Exact values: `design-tokens.css`.

### 3.3 Chip colors

A small set of muted chip tokens — `--chip-{blue,green,amber,red,purple,neutral}-{bg,fg}`
— for tags, inline badges, search-match highlights, and **note spaces**. Chips are **tinted
backgrounds with a readable foreground**, never saturated fills. Tokens exist;
`SpaceChip` consumes them for space labels in the sidebar, command palette, and spaces overview.
`neutral` is reserved for the built-in General space.

### 3.4 Contrast rules

- Body text ≥ 4.5:1 against its own surface; muted text ≥ 4.5:1 too —
  "muted" reduces weight, not legibility.
- Never encode meaning in color alone: status colors always ship with an
  icon or a word ("Saved", "Indexing", "Error").
- Both themes are first-class. Any component reviewed in one is reviewed in
  the other.

---

## 4. Motion

### 4.1 Curves and durations

Use the motion tokens in `design-tokens.css`:

- `--ease-smooth` — default for almost everything
- `--ease-out` — decorative entrances
- `--ease-spring` — badges, pops, overshoot
- `--ease-in-out` — symmetric moves (e.g. loading glow loop)
- `--duration-fast` — press, hover, focus ring
- `--duration-normal` — dropdowns, tooltips, chips
- `--duration-slow` — panels, drawers, layout shifts

`--ease-smooth` is the default; deviating requires a reason in the diff.

### 4.2 Entrances blur in — they never just fade

A plain opacity fade is banned. Entrances combine **three** properties:
opacity `0 → 1`, a small upward shift (`translateY(6px) → 0`, `8px` for
panels), and a blur that clears (`blur(4px) → blur(0)`). Use
`--duration-normal` with `--ease-out`, or `--ease-spring` for anything that
should pop. Implemented by `.u-enter`, `.u-enter-pop`, `.u-enter-panel`.

### 4.3 Press response

Every clickable element scales to `0.98` while pressed, at `--duration-fast`.
Hit targets ≥ `--hit-min` on desktop, ≥ `--hit-touch` on touch. Implemented
by `.u-press` (and `.u-lift` / `.u-slab` for compound controls).

### 4.4 Structural motion

- **Expand / collapse** uses `grid-template-rows: 0fr → 1fr` on a wrapper
  with `overflow: hidden` (`.u-disclosure` + `data-open`). `max-height`
  hacks are not accepted.
- **A control surface that grows on hover** (the editor toolbar) floats over
  the content: its host reserves the collapsed height (`.u-clamp-spacer`), so
  unrolling never pushes the text the reader is looking at. Heights are
  **measured**, not guessed (`.u-clamp-row`).
- **An element moving between containers** uses **FLIP** *(future)* — measure
  First and Last, Invert with a transform, Play it back. Never animate
  `top`/`left`.
- Long lists and large surfaces animate **movement and fade only** — no
  scale, no blur — so scrolling never looks like it is breathing. Implemented
  by `.u-content-swap` (note body, search results, empty state).
- **Theme palette changes** cross-fade every colour-bearing property over
  `--duration-slow` with `--ease-smooth`. Applied via `data-theme-transition`
  on `<html>` for one beat while tokens repoint; skipped on first paint.

### 4.5 Loading

No spinners for in-place work. The label text itself glows: a soft light
sweeps across the word from one side to the other and back, looping about
every 2s (`.u-glow`). Spinners are allowed only for the one-time
embedding-model download, where progress is genuinely long.

### 4.6 Reduced motion

`@media (prefers-reduced-motion: reduce)` is honored in `styles.css`:
transforms and blurs collapse, durations drop to `1ms`, and opacity changes
are kept so state changes stay perceivable. Reduced motion must never remove
information.

### 4.7 Signature gestures

Each recurring action owns one gesture, used consistently everywhere it
appears. Apply the CSS class; do not reimplement the motion inline.

| Action | Class | Gesture | Status |
|---|---|---|---|
| New note | `gesture-create` | The `+` rotates 90° with `--ease-spring` | Implemented |
| Delete / destructive | `gesture-danger` | Tints to `--danger` over `--danger-soft`; same press shape as neighbours | Implemented |
| Note row (select) | `gesture-annotate` | A coral vertical bar on the left grows top-to-bottom (`scaleY`) while the row lifts one elevation step | Implemented |
| Search / command palette | `gesture-search` | Magnifier lifts 1px; shortcut chip pops with `--ease-spring` | Implemented |
| Theme toggle | `gesture-theme` | Active icon rotates 20° and scales to 1.1 with `--ease-spring` | Implemented |
| Theme toggle pill | — | Active background **slides** between positions | *Future* |
| Mobile disclosure | `gesture-disclosure` | Hamburger morphs to close over `--duration-fast`; panel unrolls | Implemented |
| Attach image | `gesture-attach` | Frame icon lifts and grows slightly | Implemented |
| More toolbar controls | `gesture-more` | Chevron flips 180° with `--ease-spring` when expanded | Implemented |
| Editor toolbar control | `gesture-zoom` | Scales to 1.14 with `--ease-spring` and tints `--accent-soft` | Implemented |
| Paragraph style | `gesture-select` | Chevron dips 2px on hover | Implemented |
| Saved / indexing | `u-glow` | Text-glow sweep only — status never jumps or bounces | Implemented |

Rules: one gesture per action; never two competing gestures on one element;
every gesture degrades to a plain opacity or color change under reduced motion.

### 4.8 Depth

Depth comes from **layered light**, not from drawing boxes.

- A very low-opacity ambient wash sits behind the canvas (`body::before`) —
  two soft radial gradients in `--ambient-warm` and `--ambient-cool`, fixed
  so it never scrolls. Felt as warmth, never seen as an object.
- Primary buttons carry a solid **offset shadow body** (`.u-slab` +
  `--shadow-offset`): on press, the button translates down 2px and the offset
  shrinks — you physically push it into the page. Reserved for primary actions.
- Overlays enter from `scale(0.98)` with the standard blur entrance
  (`.u-enter-panel`), over a backdrop that fades in with `backdrop-filter:
  blur(6px)` (`.u-enter-backdrop`).
- Elevation is monotonic: nothing may cast a heavier shadow than the layer
  above it.

---

## 5. Interaction states

Every interactive element ships **six** states. A component with fewer is
incomplete:

| State | Expectation | Utility |
|---|---|---|
| Rest | Token surface, resting shadow stack | — |
| Hover | Surface lifts one step; whole card/row is the hit target | `.u-lift` |
| Active / pressed | `scale(0.98)`, `--duration-fast` | `.u-press` |
| Focus-visible | 2px `--ring` offset 2px, via `:focus-visible` only | `.u-focus` / `.u-focus-within` |
| Disabled | Reduced opacity **and** `cursor: not-allowed` **and** an accessible reason where non-obvious | component |
| Loading | Text-glow sweep; control stays the same size | `.u-glow` |

**Tooltips** (`Tooltip`, `.u-tooltip`) fade in, lift `4px` and clear a `2px`
blur over `--duration-normal`. They never appear instantly. Rules:

- **Never the native `title`.** It cannot be tokenized, renders as an OS-grey
  box, and lags by ~1s. Any control that needs a hint uses the primitive.
- Their text is a **human-readable action name in sentence case** — "Code
  block", never the identifier `codeBlock` ([§1.1](#11-brand-tone--how-the-app-talks)).
  The same string is the control's accessible name.
- The bubble is `aria-hidden` and portals to `document.body`: the trigger
  already carries the text, and a clipped or transformed ancestor would
  otherwise cut the bubble off.
- A keyboard hint may follow the label in the mono face.
- **Pointer-only on hover; keyboard-only on focus.** Tooltips supplement
  discovery for mouse hover and keyboard tabbing. They never open for touch
  (`pointerType !== "mouse"`) and never on tap focus (`:focus-visible` only).
  On touch the trigger's `aria-label` is the whole story — a bubble after a
  tap would sit on top of the control the user just pressed.

---

## 6. Elevation, radius, and typography

**Shadows are stacked, never single** — use `--shadow-rest`, `--shadow-hover`,
and `--shadow-overlay`. A hairline ring is part of the stack; in dark mode the
light hairline carries elevation where shadow alone does not read.

**Radius** is a scale: `--radius-sm` (chips, small controls), `--radius-md`
(buttons, note rows, inputs), `--radius-lg` (panels, dialogs, cards),
`--radius-full` (pills and icon buttons). Rounding is the cheapest source of
warmth.

**Typography** stays Geist Variable / Geist Mono (bundled locally, no CDN).
Headings tighten letter-spacing negatively as they grow; body copy is 16px /
1.7 in the editor (`.prose-like`) and 14px / 1.5 in chrome. Three text
weights only: `--foreground`, `--foreground-muted`, `--foreground-subtle`.

---

## 7. Layout and responsiveness

Desktop keeps the two-pane layout: note list on the left, editor on the
right, with `--border-strong` between regions. The main column (note header,
editor body, space detail) is **left-aligned** and capped at `--measure`,
with `--content-gutter` as the responsive inset from the sidebar — it stays
compact on mobile and grows with viewport width on desktop, never centering
the column in leftover space.

**Mobile (< 768px)** collapses the entire left region — brand row, search,
and note list — into a **top bar with a disclosure control** (`AppShell`):

- The bar stays pinned: brand, a hamburger/disclosure toggle, and the theme
  switch. The editor gets the rest of the screen.
- Tapping the toggle expands the panel downward over the editor using
  `.u-disclosure` at `--duration-slow` with `--ease-smooth`.
- The toggle carries `aria-expanded` plus a real label.
- Selecting a note collapses the panel automatically, returning focus to the
  editor.
- Editor toolbar controls wrap rather than scroll horizontally, and respect
  `--hit-touch`.
- **Hover is never the only way to reach something.** Touch has no hover, and
  a tapped element keeps `:hover` stuck afterwards. Anything that unrolls on
  hover also ships an explicit control with `aria-expanded` — the toolbar's
  expand toggle — and the hover rule itself is wrapped in
  `@media (hover: hover)` so the two never fight. The toggle uses
  `.u-clamp-toggle` (`(hover: none)` only): a narrow desktop window still has
  hover, so showing the button there would fight the hover unroll. For the same
  reason, pointer tooltips only open for `pointerType === "mouse"`.
- **Touch-only affordances key off capability, not width** (`.u-touch-only`
  = `(hover: none)` or a narrow window). A touch tablet sits above the `md`
  breakpoint, so a width-only rule would hide swipe actions from exactly the
  devices that need them. The toolbar expand control is the exception — see
  `.u-clamp-toggle` above.
- **`:focus-within` belongs to the collapsible region, never to a wrapper
  that also contains its toggle** — the toggle would hold the region open
  against the button that just asked it to close.
- **Text wraps; it never scrolls sideways.** The note title is a
  self-sizing `textarea` rather than an `input` for exactly this reason — a
  long title flows onto as many lines as it needs, like the body beneath it.
  It stays one logical line: newlines collapse to spaces and Enter is
  reserved for the body.

The note list and the editor are **never stacked at full height** on mobile.

---

## 8. CSS utilities

Components compose these classes from `styles.css` instead of re-deriving
transitions:

| Class | Purpose |
|---|---|
| `.u-enter` / `.u-enter-pop` / `.u-enter-panel` / `.u-enter-backdrop` | Blur-in entrances and overlay backdrop |
| `.u-content-swap` | Large-surface swap: opacity + `translateY(4px)`, no blur |
| `.u-content-column` | Main reading column: left-aligned, `--measure` cap, `--content-gutter` inset |
| `.u-press` | Press scale and fast transitions |
| `.u-lift` | Hover elevation + press |
| `.u-slab` | Primary button offset shadow body |
| `.u-focus` / `.u-focus-within` | Focus ring |
| `.u-glow` | Loading text sweep |
| `.u-disclosure` | Grid-row expand/collapse (`data-open`) |
| `.u-clamp-host` / `.u-clamp-row` / `.u-clamp-spacer` | Measured toolbar clamp. The padding belongs to the clipping row, so zoomed controls and focus rings are not cut off |
| `.u-clamp-toggle` | Toolbar expand button — `(hover: none)` only |
| `.u-tooltip-anchor` / `.u-tooltip` / `.u-tooltip-shortcut` | Tooltip bubble (see §5) |
| `.u-touch-only` | Shown only where hover is unavailable, or on narrow windows |
| `.gesture-*` | Signature gestures (see §4.7) |

Pair utilities with token variables: `bg-[var(--surface)]`,
`rounded-[var(--radius-md)]`, `shadow-[var(--shadow-rest)]`, etc.

---

## 9. From criteria to code

The flow is one-directional:

```
design principles  →  design.md (criteria in prose)  →  design-tokens.css (values)  →  styles.css (utilities)  →  components
```

- **Adding a role** — describe it here first (why), then add the value in
  `design-tokens.css`, then consume it.
- **Changing a value** — edit `design-tokens.css` only; update this doc if
  the *meaning* of the role changed.
- Themes switch via `html[data-theme="light" | "dark"]`, with
  `prefers-color-scheme` as the fallback for `html:not([data-theme])`.
  Explicit choice always wins.

---

## 10. Review checklist

- [ ] No literal colors, durations, easings, radii, or shadows in the diff.
- [ ] All six interaction states present, including `:focus-visible`.
- [ ] Entrance uses opacity + shift + blur, not a bare fade.
- [ ] Pressed state scales to `0.98`.
- [ ] Verified in both themes, and at 375px width.
- [ ] `prefers-reduced-motion` path checked.
- [ ] Status communicated by icon or text, not color alone.
- [ ] The action uses its signature gesture ([§4.7](#47-signature-gestures)), and only that one.
- [ ] Nothing casts a heavier shadow than the layer above it ([§4.8](#48-depth)).
- [ ] No emoji as UI affordances; line SVG icons only ([§1.2](#12-visual-identity)).
