# Claude Guidance

Read `AGENTS.md` first. Use `docs/context-map.md` to choose focused context, then follow the scoped rules in `.claude/rules/` and any slash command under `.claude/commands/`.

This repo is React + TypeScript + Vite 8, TypeScript Azure Functions under Static Web Apps `/api`, shared Zod contracts, Cosmos DB, and static fallback JSON. Root `ARCHITECTURE.md` is the canonical technical reference; update it when structure, routes, modules, env vars, deployment, infrastructure, or runtime flow changes.

Rules to preserve:

- Frontend calls `/api` only.
- Do not expose raw JWTs or real secrets.
- Public/student responses must not expose private identity, school IDs, raw patches, private notes, or audit records.
- Keep static-hosting navigation fallback working.
- Require explicit user confirmation immediately before production deploys, DNS changes, or Cosmos seed/migrate/prune operations.
- Before new UI feature implementation, show the user an ASCII mock and wait for confirmation.

Common commands:

- `/test`: run project validation.
- `/lint`: explain the missing lint script and run available type checks.
- `/smoke-test`: smoke test local or deployed endpoints.
- `/deploy`: deploy through `npm run deploy:azure` after confirmation.
- `/verify-deploy`: verify production endpoints after deploy.
- `/update-arch`: update architecture/context docs.
- `/cosmos-inspect`: inspect Study Companion Cosmos containers.

Always run `python3 scripts/check-ai-context.py` after modifying AI context files.
