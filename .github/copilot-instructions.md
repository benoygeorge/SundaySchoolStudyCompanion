# Sunday School Study Companion Copilot Instructions

Read `AGENTS.md` first, then use `docs/context-map.md` to load the smallest useful context set. Current technical details live in root `ARCHITECTURE.md`; this repo does not use a separate `docs/ARCHITECTURE.md`.

Stack: React 19 + TypeScript + Vite 8 in `src/`, TanStack Query, React Router, TypeScript Azure Functions in `api/`, shared Zod contracts in `shared/studyContracts.ts`, Cosmos DB through the API, and static fallback JSON in `public/data/`.

Golden rules:

- Frontend code calls Study Companion `/api` only. Do not call the Exam API from browser code.
- Never expose raw JWTs or real secrets in source, docs, local storage, logs, or generated examples.
- Public and student payloads must not expose identities, school IDs, private notes, raw patches, or audit data.
- Keep Azure Static Web Apps navigation fallback compatible.
- Use contract-first changes through `shared/studyContracts.ts`.
- Update `ARCHITECTURE.md` when structure, routes, modules, env vars, deployment, infrastructure, or runtime flow changes.
- Production mutations, deploys, DNS changes, and Cosmos seed/migrate/prune operations require explicit user confirmation immediately before running.

Validation:

- AI context: `python3 scripts/check-ai-context.py`
- General: `npm run typecheck`
- Frontend build: `npm run build`
- API build: `npm run --prefix api build`
- Cosmos inspection: `npm run --prefix api cosmos:inspect`
- Deploy: `npm run deploy:azure`

There is currently no lint script or dedicated test runner. Do not claim lint/tests ran unless those scripts are added and executed.
