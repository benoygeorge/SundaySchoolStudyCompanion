# Repository Guidance

## Quick Context

- Stack: React 19 + TypeScript + Vite 8 in `src/`; TypeScript Azure Functions in `api/src/functions/`; shared Zod contracts in `shared/studyContracts.ts`; Cosmos DB via the API with `public/data/` as static fallback/manual reference.
- Hosting: Azure Static Web Apps serves the Vite bundle and managed `/api` Functions. `staticwebapp.config.json` owns navigation fallback and Node 20 API runtime.
- Canonical technical reference: `ARCHITECTURE.md` at the repo root. This repo already has that equivalent, so do not add a duplicate `docs/ARCHITECTURE.md` unless intentionally moving the canonical file.

## Start Here

- Read `ARCHITECTURE.md` for the current implementation before changing code.
- Read `docs/context-map.md` to choose the smallest useful context set.
- Read `docs/design.md` before changing UI, layout, CSS, copy, or interaction behavior.
- Read `docs/plan.md` before changing API contracts, auth, Cosmos schemas, moderation workflows, or Azure architecture.
- Use the repo-local skills in `docs/skills/` for repeated workflows.
- Before implementing any new UI feature, show the user an ASCII mock and wait for confirmation.

## Golden Rules

- Keep browser calls on the Study Companion origin. Frontend code calls `/api`; it must not call the Exam API directly.
- Do not expose raw JWTs to JavaScript-readable storage. Browser auth uses the Study Companion HttpOnly session cookie plus CSRF/session-header support already implemented.
- Public and student payloads must not expose user IDs, names, emails, phone numbers, school IDs, private notes, raw pending patches, or audit records.
- Keep static-hosting compatibility. Client routes must continue to work with Azure Static Web Apps navigation fallback.
- Store secrets only in `.env` locally or Azure Static Web Apps app settings. Never commit real keys, tokens, passwords, or deployment tokens.
- Dedicated Azure resources for this repo belong in `rg-sundayschool-studycompanion-central` in Central US. The shared Cosmos account `exam-cosmosdb` is the intentional exception.
- Prefer small, local edits that match existing modules. Do not introduce a new framework or service without updating `docs/plan.md` and `ARCHITECTURE.md`.
- Do not preserve legacy data contracts by default. When the curriculum or API schema changes, update the source data, seed scripts, Cosmos documents, docs, and UI to the new shape instead of carrying old fields forward.

## Key Entry Points

- `src/App.tsx`: study UI, auth shell, and admin management UI.
- `src/api/*Client.ts`: all browser API access. Keep requests on `/api`.
- `api/src/functions/`: Azure Functions route handlers.
- `api/src/auth/`: Exam auth proxy, role mapping, encrypted Study Companion sessions, CSRF checks.
- `api/src/data/`: Cosmos and static fallback stores.
- `shared/studyContracts.ts`: Zod schemas and inferred TypeScript types.
- `public/data/`: static fallback grade index and per-grade JSON.
- `api/scripts/study-cosmos.mjs`: Cosmos inspect, seed, migrate, and prune utilities.
- `scripts/deploy-azure-static-webapp.sh`: production deploy helper.

## Conventions

- Start contract-first in `shared/studyContracts.ts`, then update API serializers, frontend clients, seed/static data, and docs.
- API responses use `{ success, data, message?, trace_id? }` and `{ success: false, error, trace_id? }`.
- Keep raw Cosmos documents behind explicit public/student/admin serializers.
- Frontend server state uses TanStack Query; data access stays in `src/api/`.
- UI must follow `docs/design.md`: study content first, no marketing hero, no nested cards, complete mobile states, labels/errors/loading states.
- Production or data-mutating commands require explicit user confirmation immediately before execution.

## Common Tasks

- UI change: read `src/AGENTS.md` and `docs/design.md`; run `npm run typecheck:app` or `npm run build`.
- API/auth/contract change: read `api/AGENTS.md` and relevant `docs/plan.md`; run `npm run typecheck:api` and usually `npm run --prefix api build`.
- Static fallback data change: read `public/data/AGENTS.md`; keep `grade-index.json` and grade JSON in sync.
- Cosmos/schema change: read `api/scripts/AGENTS.md`; run `npm run --prefix api cosmos:inspect` when credentials are available.
- Deployment: read `scripts/AGENTS.md`; use `npm run deploy:azure` only after explicit confirmation.
- AI context change: run `python3 scripts/check-ai-context.py`.

## Validation Commands

- `npm run typecheck`
- `npm run build`
- `npm run --prefix api build`
- `npm run --prefix api cosmos:inspect`
- `npm run deploy:azure`
- `python3 scripts/check-ai-context.py`

Use `npm run deploy:azure` for routine publishes instead of ad-hoc Azure deploy commands.
There is currently no lint script or dedicated test runner in `package.json` or `api/package.json`; do not claim lint/tests ran unless new scripts are added and executed.

## Docs Map

- `ARCHITECTURE.md`: current implementation, runtime flow, env vars, Cosmos model, deployment commands. Update it when structure, routes, modules, env vars, deployment, or infrastructure change.
- `docs/context-map.md`: task routing and minimal context sets.
- `docs/design.md`: UI rules.
- `docs/plan.md`: target API/auth/Cosmos/Azure contract.
- `README.md`: local run, content model, Azure deploy notes.

## Skills Map

- Repo-local skills: `docs/skills/study-companion-ui/`, `docs/skills/study-companion-api-data/`, `docs/skills/study-companion-azure-ops/`.
- AI-agent skills: `.agents/skills/` for Codex-style agents and byte-identical mirrors in `.github/skills/` for GitHub Copilot.
- Claude commands: `.claude/commands/`; Copilot scoped instructions: `.github/instructions/`.

## Content Rules

- Keep questions and references together in the same per-grade JSON fallback file unless the architecture changes.
- When adding a fallback grade, update both `public/data/grades/` and `public/data/grade-index.json`.
- New persistent content should be entered through Cosmos/API workflows, not by treating JSON as the production source of truth.
- Static JSON may be used as a manual reference or seed source, but it must follow the current shared contract rather than an older compatibility shape.
