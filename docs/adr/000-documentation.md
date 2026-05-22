# ADR-000: Architecture Decision Records

- **Status:** Accepted
- **Date:** 2026-05-19

## Context

The app has several non-obvious engineering choices (local File System Access API, on-device embeddings, separate semantic index, custom Markdown round-trip). We need a lightweight way to record **why** a decision was made, not only **what** the code does.

## Decision

- Store ADRs under `docs/adr/` as Markdown files: `NNN-short-title.md`.
- Write the body in **English**; keep each ADR to about one page (lean).
- Use this structure:

```markdown
# ADR-NNN: Title
- **Status:** Accepted | Superseded by ADR-XXX
- **Date:** YYYY-MM-DD

## Context
## Decision
## Consequences
### Positive / Negative / Neutral
## Diagram (optional)
## References
```

- **Status `Accepted`:** current truth.
- **Status `Superseded`:** keep the file; add a line pointing to the replacing ADR.
- Cross-link related ADRs and `docs/architecture.md`.
- Prefer a **mermaid diagram** only when it clarifies a flow (not for every ADR).
- Link to **official documentation** (MDN, specs, library docs) rather than duplicating API details.

## Consequences

### Positive

- New contributors can read decisions without archaeology in PRs.
- Superseded ADRs preserve history.

### Negative

- ADRs can drift from code if not updated when behavior changes.

### Neutral

- `docs/architecture.md` describes **how** the system fits together; ADRs describe **why** we chose it.

## References

- [Documenting architecture decisions (Michael Nygard)](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [MADR template](https://adr.github.io/madr/)
