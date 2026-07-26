# Application standards for AI agents

A technology-agnostic standard for building a **new application** to the same
bar as this project. It distills the practices encoded across
[`AGENTS.md`](../AGENTS.md), [`docs/architecture.md`](./architecture.md),
[`docs/design.md`](./design.md), [`docs/testing.md`](./testing.md), and the
[ADRs](./README.md) into principles you can apply regardless of language,
framework, or platform.

**How to use this guide.** Read it before you scaffold anything. Each section
is a set of *rules* and *checks*, not suggestions. When a rule and a concrete
request conflict, stop and surface the conflict rather than silently breaking
the rule. Name specific tools only inside a project's own stack document — this
guide names none on purpose.

---

## 0. First principles

1. **Decide the invariants before the features.** Every app has two or three
   properties that override all other rules (privacy, data ownership, offline
   capability, a platform constraint). Write them down first. Any change that
   would break one is not a change to make — it is a decision to escalate.
2. **Smallness is a feature.** Prefer deleting code over adding it, a local
   helper over a dependency, one library per concern over three that overlap.
   The best architecture is the least architecture that still holds the
   invariants.
3. **One source of truth per fact.** Data, configuration, design values, and
   decisions each live in exactly one place; everything else derives from it.
4. **Make the reversible cheap and the irreversible loud.** Optimize for fast,
   safe iteration on the inside; gate anything hard to undo (schema changes,
   data-format changes, external calls) behind an explicit, recorded decision.

---

## 1. Product mindset

- **Serve one clear job.** State in a sentence what the app is and what it
  refuses to be ("a quiet tool that reacts", not "a dashboard, not a toy").
  Scope creep is the default failure mode; a written non-goals list is the
  cheapest defense.
- **Respect the user's ownership.** Prefer formats and storage the user
  controls and can inspect with ordinary tools. If the user's content can live
  as plain, portable files or standard records, it should — proprietary blobs
  are a last resort, justified in writing.
- **Default to privacy.** Do not send user content anywhere it does not
  strictly need to go. Every outbound call is a decision with a reason; make
  the set of allowed calls small, explicit, and auditable. State privacy as a
  plain fact, never as a marketing badge.
- **Automatic over ceremonial.** Persistence, sync, and recovery should happen
  without the user asking. Avoid "Save" buttons and modal ceremony where the
  system can simply do the right thing and show the result.
- **Choose the right primitive for the job.** Don't reach for the largest
  possible tool because it's fashionable; pick the mechanism that actually fits
  the problem (see this project's "why not a generative LLM for search"
  reasoning). Power you don't need is complexity you pay for.
- **Degrade honestly.** When a capability is unavailable, detect it up front,
  explain it plainly, and offer the one action that helps — never fail silently
  or pretend.

---

## 2. Architecture

### 2.1 Layered, dependency-inward design (DDD)

Organize the codebase into layers with a strict one-directional dependency
rule. The concrete names matter less than the boundaries:

| Layer | Contains | May depend on |
|-------|----------|---------------|
| **Domain** | Entities, value objects, aggregate helpers, pure business rules and policies | Nothing outside itself |
| **Application** | Ports (interfaces), use cases, session/orchestration state, view models, error policy | Domain (+ a shared kernel) |
| **Infrastructure** | All I/O: storage, network, platform APIs, serialization — *implements the ports* | Domain, application ports |
| **Presentation** | UI, screens, input handling — consumes **view models**, never raw persistence types | Application view models, shared UI kernel |
| **Shared kernel** | Cross-cutting utilities with **no business concept** (formatting, small helpers, platform detection) | Nothing business-specific |

Rules that make this real:

- **Dependencies point inward only.** Domain knows nothing about the UI,
  storage, or the framework. Infrastructure depends on the domain, not the
  reverse.
- **Cross a boundary through a port.** The application defines an interface;
  infrastructure implements it. This is what lets you swap real I/O for fakes
  in tests and change a backend without touching business logic.
- **The presentation layer never imports persistence types.** Re-project domain
  data into *view models* shaped for the screen. A screen that imports a
  database record is a boundary violation.
- **Keep one composition point.** There should be exactly one place where
  concrete infrastructure is wired to the application (a composition root or
  factory module). Business code asks for a port; only composition knows the
  implementation.
- **Enforce the boundaries mechanically.** A rule that lives only in a doc will
  erode. Configure the linter/build to fail on illegal cross-layer imports.
  When you add a boundary rule, make sure it actually matches (barrel/index
  imports are the classic hole).

### 2.2 Data and schema

- **Source of truth on disk/records; everything else is a derivable cache.**
  Indexes, search structures, thumbnails, and UI state must be rebuildable from
  the canonical data. Treat them as caches you can wipe and regenerate.
- **Version every persisted schema.** Store a schema version with the data.
  Define the behavior on mismatch up front: migrate when older, refuse (or
  isolate) when newer than the app understands. Any format change bumps the
  version and is recorded as a decision.
- **Own your storage layout.** If the app manages a folder or namespace,
  document its layout and treat changes to it as schema changes.
- **Make writes recoverable, not necessarily transactional.** If you can't get
  true atomicity, design for it: reconcile on startup from the source of truth,
  keep the derivable cache narrowly scoped so conflicts stay small, and
  serialize concurrent writers to shared structures.

### 2.3 Concurrency and background work

- **Keep the interactive path free.** Move heavy or long-running work
  (indexing, large I/O, expensive computation) off the thread/path that handles
  user input. The UI must stay responsive while work proceeds.
- **Report progress through one channel.** Long tasks surface progress via a
  single callback/observable, not scattered state.
- **Guard async against teardown.** Effects and tasks that outlive their caller
  must check for cancellation/unmount before applying results.
- **Request privileged capabilities inside a user gesture.** Permissions,
  pickers, and anything the platform gates on user intent are requested at the
  moment of the gesture; background code checks whether it already has
  permission and never prompts.

---

## 3. Code quality

- **Pick one library per concern; never two that overlap.** Maintain a single
  stack document listing the chosen tool for each concern and an explicit list
  of things forbidden without a recorded decision. Adding an overlapping
  dependency is a decision, not a convenience.
- **Strict typing, no escape hatches.** Turn on the strictest type checking
  available and treat it as the source of truth for types. Ban untyped escapes
  (`any` and equivalents); model unknowns explicitly and narrow them. If an
  escape is truly unavoidable, make it loud, local, and commented.
- **Consistent, boring naming.** One casing convention per artifact kind
  (components, modules, files), applied everywhere. New code should read like
  the code already there.
- **Small, single-concern units.** One responsibility per module/file; one
  concept per commit. If a file orchestrates everything, that is the smell to
  fix, not the pattern to copy.
- **Optimize deliberately, not reflexively.** Reach for memoization, caching,
  and other complexity only when there is a concrete reason (a measured cost, a
  stability requirement). Premature optimization is just complexity.
- **Comments explain intent and trade-offs, never mechanics.** Don't narrate
  what the code plainly does or describe the diff. Explain *why* — the
  constraint, the gotcha, the reason it isn't the obvious way.
- **Keep diffs small and focused.** Short, imperative commit messages that
  reference the relevant decision or file. One concern per change.

---

## 4. Design system

Applies to any app with a UI. The discipline transfers even when the visual
language differs.

- **Design tokens are the only source of visual values.** Colors, spacing,
  radii, durations, easings, shadows, and typography live as named tokens in
  one place. A literal hex, pixel radius, or magic duration in a component is a
  bug. Define light and dark (or all supported themes) as first-class from the
  start.
- **Name colors by role, not by hue.** `surface`, `foreground`, `accent`,
  `danger`, `ring` — never `blue` or `#…`. Roles survive a re-theme; hues
  don't. Keep the palette small: a few text weights, one chromatic accent in
  the chrome, muted tints reserved for user content.
- **Build a component hierarchy.** *Primitives* wrap a single element and take
  styling overrides; *compositions* combine primitives, own layout, and may
  carry product copy; a thin *root* wires everything together. Screens don't
  import from the root; primitives don't know about product logic.
- **Every interactive element ships a full set of states.** Rest, hover,
  pressed, focus-visible, disabled (with an accessible reason), and loading. A
  control missing any of these is incomplete.
- **Motion is specified, never vague.** Every animation names an exact
  duration token and an exact easing token. "Smooth" is not a spec. Prefer one
  consistent gesture per recurring action, reused everywhere that action
  appears — and never two competing motions on one element.
- **Depth and warmth come from light and layering,** not from heavy borders or
  chrome. Keep elevation monotonic: nothing casts a heavier shadow than the
  layer above it.
- **Write UI copy like a calm, competent friend.** Second person, present
  tense, plain words, short. Errors state the fact then the fix and never blame
  the user. No stack traces or error codes in sentences. Sentence case.
- **Criteria → tokens → utilities → components, one direction.** Document the
  *why* in prose, put the *values* in tokens, express shared behavior as
  reusable utilities, then compose components. New roles are described before
  they're valued.

---

## 5. Accessibility

Accessibility is not a pass at the end; it is part of "done".

- **Visible focus on everything interactive.** A clear focus indicator via the
  focus-visible state, never removed for aesthetics.
- **Never encode meaning in color alone.** Status always ships with an icon or
  a word ("Saved", "Error"), not just a red/green.
- **Meet contrast minimums.** Body and "muted" text alike clear the standard
  contrast ratio against their own surface. Muted means lighter weight, not
  lower legibility.
- **Everything reachable without a pointer.** Full keyboard operability;
  logical focus order; focus returned sensibly after dialogs and disclosures.
- **Give controls real accessible names.** Human-readable, in sentence case;
  the visible label and the accessible name agree. Don't rely on platform
  tooltips for essential information.
- **Hover is never the only path.** Touch has no hover. Anything revealed on
  hover also has an explicit control; gate hover-only behavior so it can't
  fight touch.
- **Adequate hit targets,** larger on touch than on pointer devices.
- **Honor reduced-motion.** When the user asks for less motion, collapse
  transforms and blurs and shorten durations — but keep the state change
  perceivable. Reduced motion must never remove information.
- **Review in every theme and at a small screen width.** A component checked in
  one theme is checked in the other.

---

## 6. Testing

- **A pyramid, not an ice-cream cone.** Many fast unit tests over pure
  logic; fewer component tests with mocked dependencies; a thin layer of
  integration tests over real flows. Defer heavyweight end-to-end tooling until
  the value justifies it.
- **Test the public surface, not private helpers.** Cover a module through the
  contract callers actually use; that keeps tests from ossifying internals.
- **Layered design pays off here.** Because I/O sits behind ports, test
  business logic with in-memory fakes and port doubles instead of real
  storage/network. Provide a small, shared set of test doubles and an
  integration harness so tests are easy to write the intended way.
- **Every new behavior gets at least one test.** Bug fixes get a test that fails
  before and passes after.
- **Determinism is mandatory.** Control time, randomness, and async ordering
  (fake timers, seeded fakes). A flaky test is a broken test.
- **Co-locate tests with the code** they cover, under a consistent naming and
  folder convention.
- **The gate is green typecheck, tests, and lint.** These run in CI on every
  change and block merge. "Done" means all three pass locally too.

---

## 7. Performance

- **Instant-feeling interaction is the target.** Update the UI optimistically
  on user action; persist and reconcile shortly after. Never block input on a
  disk write, a network round-trip, or a recompute.
- **Debounce and batch expensive work.** Coalesce rapid events (typing,
  resizing) before doing costly work; write "memory first, disk soon, index
  later," and flush pending work on teardown/exit so nothing is lost.
- **Do work incrementally.** Reprocess only what changed (a saved item, a
  changed input) instead of everything, and skip work when a content
  hash/fingerprint shows nothing changed.
- **Keep the initial load small.** Split heavy or rarely-needed code so it
  loads after the core experience is interactive. Pay for capability only when
  it's used.
- **Cache derivable results, and know how to invalidate.** Every cache has an
  explicit invalidation rule (content hash, version, identity of the producer).
  A cache you can't invalidate correctly is a bug waiting to surface.
- **Measure before optimizing, and again after.** Optimize against evidence,
  not intuition. Complexity added without a measured win is a regression in
  disguise.

---

## 8. Documentation and decisions

- **Record architectural decisions.** For any non-trivial decision, write a
  short, dated record: context, the decision, and its consequences (positive,
  negative, neutral). Keep them lean — decisions, not tutorials. When a decision
  is replaced, keep the old record with a pointer to the new one.
- **Separate the audiences.** A user-facing readme for setup and usage;
  engineering docs (architecture map, ADRs, testing strategy, design criteria)
  for contributors.
- **Keep docs in sync with behavior.** When you change behavior a document
  describes, update that document in the same change.
- **One language for all artifacts.** Code, identifiers, comments, commits, and
  docs use one project language consistently — even when the request comes in
  another. Translate the idea; never mix languages in the artifacts.

---

## 9. Workflow and definition of done

- **Develop on a branch, commit in focused steps, and keep history clean.**
- **Before completing a change, confirm:** typecheck passes, tests pass, lint
  passes; no new overlapping dependency slipped in; any architectural or
  schema change has a recorded decision; docs touched by the change are updated.
- **When unsure:** read the relevant decision record, mirror the closest
  existing module for shape and tone, prefer removing code to adding it, and
  prefer a small local primitive to a new dependency. If it's still ambiguous,
  draft the decision and ask before implementing.

---

## 10. Bootstrapping checklist for a new app

1. Write the **mission and 2–3 invariants**; write the **non-goals**.
2. Choose the **layers** and the **dependency-inward rule**; set up
   lint/build enforcement of boundaries from commit one.
3. Define the **canonical data model and schema version**; decide
   migrate/refuse-on-mismatch behavior.
4. Stand up the **design tokens** (both/all themes) and the primitive →
   composition → root hierarchy before building screens.
5. Establish the **test pyramid**, shared test doubles, and a CI gate
   (typecheck + tests + lint).
6. Wire the **performance defaults**: optimistic UI, debounced persist,
   incremental/deferred work, code-splitting.
7. Bake in **accessibility defaults**: focus-visible, contrast, keyboard
   paths, reduced-motion, non-color status.
8. Create the **decision-record** location and the **stack document** (one
   tool per concern). Record the first decisions.
