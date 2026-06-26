---
name: sunday-school-study-companion-test-suite
description: 'Use when: running the Sunday School Study Companion validation suite, checking changes before handoff, reporting unavailable tests, or investigating type/build regressions.'
---

# Sunday School Study Companion Test Suite

## Context

- Read `AGENTS.md` and any scoped `AGENTS.md` that covers changed files.
- There is currently no dedicated unit test runner or lint script. Treat TypeScript/build checks as the available test suite unless new scripts are added.

## Commands

Run the smallest relevant set:

```bash
python3 scripts/check-ai-context.py
npm run typecheck
npm run build
npm run --prefix api build
npm run --prefix api cosmos:inspect
```

Use `python3 scripts/check-ai-context.py` for AI context changes.
Use `npm run typecheck` for general TypeScript validation.
Use `npm run build` when frontend, shared contracts, routing, CSS, or packaging changed.
Use `npm run --prefix api build` when API output or deploy packaging changed.
Use `npm run --prefix api cosmos:inspect` after Cosmos schema/script/container changes and only when credentials are available.

## Reporting

- List every command run and whether it passed.
- If a command fails, include the first actionable error lines.
- If a command was skipped, state the concrete reason.
- Do not say tests or lint passed unless an actual test or lint command exists and was run.
