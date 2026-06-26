# Docs And AI Context Rules

- Root `ARCHITECTURE.md` is the canonical implementation reference.
- Update architecture/context docs when routes, modules, contracts, env vars, deployment, infrastructure, runtime flow, or agent workflows change.
- Keep always-on context under about 32 KB and move detailed workflows into skills or commands.
- Mirror every `.agents/skills/<name>/SKILL.md` byte-for-byte in `.github/skills/<name>/SKILL.md`.
- Run `python3 scripts/check-ai-context.py` after AI context edits.
