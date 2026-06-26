# /cosmos-inspect

Inspect Study Companion Cosmos state without mutating data.

1. Read `api/scripts/AGENTS.md` and `docs/skills/study-companion-azure-ops/SKILL.md`.
2. Confirm local `.env` or app settings are available, but do not print secret values.
3. Run `npm run --prefix api cosmos:inspect`.
4. Report container names, counts, and any non-canonical `study-*` containers.
5. Do not run seed, migrate, or prune commands unless the user explicitly requests the mutation and confirms immediately before execution.
