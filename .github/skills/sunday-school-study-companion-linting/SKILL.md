---
name: sunday-school-study-companion-linting
description: 'Use when: asked to lint, format-check, run static quality checks, or explain the current absence of a dedicated lint command in Sunday School Study Companion.'
---

# Sunday School Study Companion Linting

## Current State

This repo currently has no ESLint config, Prettier config, lint script, or dedicated formatter script in `package.json` or `api/package.json`.

## Commands

Use existing quality gates:

```bash
npm run typecheck
python3 scripts/check-ai-context.py
```

Run the AI context check only when AI context files changed.

## Reporting

- State clearly that no lint command is configured.
- Report TypeScript typecheck results as typecheck results, not lint results.
- Do not add lint tooling unless the user explicitly asks for that project change.
