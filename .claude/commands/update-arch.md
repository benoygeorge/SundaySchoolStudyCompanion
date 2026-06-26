# /update-arch

Update architecture and context documentation after structural changes.

1. Read `AGENTS.md`, `ARCHITECTURE.md`, and `docs/context-map.md`.
2. If the change touches UI behavior, read `docs/design.md`; if it touches API/auth/Cosmos/Azure, read relevant `docs/plan.md` sections.
3. Update `ARCHITECTURE.md` for structure, routes, modules, env vars, deployment, infrastructure, or runtime flow changes.
4. Update `docs/context-map.md`, scoped `AGENTS.md`, Copilot instructions, Claude rules/commands, or skills when agent routing changes.
5. Run `python3 scripts/check-ai-context.py`.
6. Report the docs updated and any implementation facts that still need confirmation.
