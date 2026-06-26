---
name: sunday-school-study-companion-architecture-doc-maintenance
description: 'Use when: updating Sunday School Study Companion architecture docs, context maps, agent instructions, or technical references after structural, route, module, env var, deployment, or infrastructure changes.'
---

# Sunday School Study Companion Architecture Doc Maintenance

## Canonical Files

- `ARCHITECTURE.md` is the current implementation reference.
- `docs/context-map.md` routes future agents to focused context.
- `docs/design.md` owns UI behavior and copy.
- `docs/plan.md` owns target API, auth, Cosmos, moderation, and Azure architecture.

## Workflow

1. Read `AGENTS.md`, `ARCHITECTURE.md`, and `docs/context-map.md`.
2. Read `docs/design.md` for UI behavior changes.
3. Read relevant `docs/plan.md` sections for API/auth/Cosmos/Azure changes.
4. Update `ARCHITECTURE.md` when structure, routes, modules, env vars, deployment, infrastructure, or runtime flow changes.
5. Update scoped `AGENTS.md`, Copilot instructions, Claude rules/commands, and skills when agent routing or workflows change.
6. Run:

```bash
python3 scripts/check-ai-context.py
```

## Reporting

- List docs updated and why.
- Note any implementation facts that were inferred rather than verified.
- Keep always-on docs concise; move detailed workflows to skills or commands.
