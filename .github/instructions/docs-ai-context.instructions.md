---
applyTo: "AGENTS.md,CLAUDE.md,.cursorrules,ARCHITECTURE.md,README.md,docs/**/*.md,.agents/**/*.md,.github/**/*.md,.claude/**/*.md"
---

# Docs And AI Context Instructions

- Keep always-on files concise and durable. Move detailed repeatable workflows to skills or slash commands.
- Root `ARCHITECTURE.md` is the canonical technical reference. Update it when structure, routes, modules, env vars, deployment, infrastructure, or runtime flow changes.
- Update `docs/context-map.md` when future agents need different routing context.
- Mirror every `.agents/skills/<name>/SKILL.md` exactly in `.github/skills/<name>/SKILL.md`.
- Run `python3 scripts/check-ai-context.py` after changing AI context files.
