# Docs Guidance

- Keep `../ARCHITECTURE.md` as the canonical technical reference for the current implementation.
- Update `../ARCHITECTURE.md` when structure, routes, modules, env vars, deployment, infrastructure, or runtime flow changes.
- Update `context-map.md` when new files, skills, or task routes become important for future agents.
- `design.md` owns UI behavior and copy rules; `plan.md` owns target API/auth/Cosmos/Azure decisions.
- Keep always-on agent docs concise. Put detailed repeatable workflows in `.agents/skills/`, `.github/skills/`, `.claude/commands/`, or `docs/skills/`.
- Run `python3 scripts/check-ai-context.py` after changing AI context files.
