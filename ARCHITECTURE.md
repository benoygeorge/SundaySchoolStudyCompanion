# Architecture

This is the current implementation snapshot. `docs/plan.md` remains the target platform contract. Update this file when structure, routes, modules, environment variables, deployment, infrastructure, or runtime flow changes.

This repo uses root `ARCHITECTURE.md` as the canonical technical reference. Do not add a parallel `docs/ARCHITECTURE.md` unless the canonical file is intentionally moved.

## System Shape

- Static frontend: React, TypeScript, React Router, TanStack Query, Vite 8.
- Managed API: TypeScript Azure Functions under Azure Static Web Apps `/api`.
- Shared contracts: Zod schemas in `shared/studyContracts.ts`.
- Data source: Cosmos DB for production reads; JSON files in `public/data/` are fallback/manual-reference artifacts.
- Hosting: Azure Static Web App `sundayschool-studycompanion`.

## Source Map

- `src/App.tsx`: current study UI, auth shell, and admin management UI.
- `src/api/studyClient.ts`: frontend study-data client for `/api/grades` and `/api/grades/{gradeId}/study-payload`.
- `src/api/authClient.ts`: frontend auth client for `/api/auth/*`.
- `src/styles.css`: app styling and responsive layout.
- `api/src/functions/`: Azure Functions route handlers.
- `api/src/auth/`: Exam auth integration, role mapping, encrypted Study Companion session cookie.
- `api/src/data/`: Cosmos and static fallback stores.
- `api/scripts/study-cosmos.mjs`: Cosmos inspect, seed, and guarded prune utilities.
- `shared/studyContracts.ts`: API envelope, auth, grade, payload, and question contracts.
- `scripts/deploy-azure-static-webapp.sh`: production deploy helper.
- `scripts/check-ai-context.py`: validates AGENTS, Copilot, Claude, Cursor, and mirrored skill context.
- `staticwebapp.config.json`: navigation fallback and managed API runtime.
- `.agents/skills/` and `.github/skills/`: byte-identical AI workflow skills.
- `.github/instructions/`: scoped GitHub Copilot instructions.
- `.claude/`: Claude rules and slash-command prompts.

## Runtime Flow

1. Browser loads the static Vite bundle from Azure Static Web Apps.
2. The frontend fetches grade metadata from `GET /api/grades`.
3. The frontend fetches study data from `GET /api/grades/{gradeId}/study-payload`.
4. The managed API reads Cosmos through `CosmosStudyStore` when Cosmos settings are present.
5. If static fallback is enabled, the API can fall back to `public/data/`; production disables that fallback.

## Authentication Flow

1. Browser posts credentials to `POST /api/auth/login`.
2. The Study Companion API calls the Exam API server-to-server.
3. Allowed Exam roles are mapped to `Student`, `Teacher`, or `Admin`.
4. The API encrypts the Exam JWT into the `sc_session` HttpOnly cookie and returns the same encrypted Study session token for browsers that need a header fallback.
5. The browser stores the CSRF token and encrypted Study session token. It must never store the raw Exam JWT.
6. `GET /api/auth/me` validates the cookie or `x-study-session` header by decrypting the Study session and verifying the Exam token server-to-server.

Known non-browser limitation: direct script/curl login without a reCAPTCHA Enterprise token can return `Security verification failed. Please refresh the page and try again.` Browser login should use the frontend reCAPTCHA flow.

## Cosmos Model

Canonical containers:

| Container | Partition key | Current purpose |
| --- | --- | --- |
| `study-content` | `/gradeId` | Curriculum, questions, suggestions, flags, user role context, content audit |
| `study-comments` | `/gradeId` | Comments and comment audit |
| `study-ratings` | `/questionId` | Rating summaries and future per-user ratings |

Current seeded data:

- `study-content`: Grade 1-9 curriculum shells, Grade 10 curriculum, 559 questions, one suggestion, one flag, one audit entry, one user role context.
- `study-comments`: one approved comment and one comment audit entry.
- `study-ratings`: one rating summary.

Current curriculum contract:

- Grade curriculum owns `books`, optional book `sections`, `chapters`, and `referenceLinks`.
- Every chapter belongs to a book through `chapter.bookId`; `chapter.sectionId` is optional.
- Every question has required placement through `question.chapterId`.
- Question citations are optional and use `sourceType`, plus optional `bookId`, `chapterId`, `referenceId`, page range, and excerpt.
- References use structured metadata: `resourceType`, `importance`, and `scope`; `href` is optional for non-link resources.

Do not recreate the old split containers such as `study-questions`, `study-curriculum`, `study-flags`, or `study-suggestions`.

## Azure Boundary

Dedicated resources for this repo belong in:

```text
rg-sundayschool-studycompanion-central
```

Current dedicated resource:

- Azure Static Web App `sundayschool-studycompanion` in Central US.

Intentional shared dependency:

- Cosmos DB account `exam-cosmosdb`, database `exam-cosmosdb`, outside the dedicated resource group.

Production app settings are on the Static Web App. Do not print or commit setting values.

Required setting names:

- `COSMOS_DATABASE_ID`
- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `STUDY_DISABLE_STATIC_FALLBACK`
- `STUDY_SESSION_SECRET`
- `EXAM_AUTH_BASE_URL`
- `STUDY_COOKIE_SECURE`

## Build And Deploy

- `npm run typecheck` checks app and API TypeScript.
- `npm run build` typechecks and builds the frontend.
- `npm run --prefix api build` builds the managed API.
- `npm run deploy:azure` builds and deploys frontend plus API to production.
- `npm run --prefix api cosmos:inspect` verifies canonical Study Companion containers.
- `npm run --prefix api cosmos:seed` seeds Grade 10 from static JSON.
- `npm run --prefix api cosmos:prune-study-containers` deletes non-canonical empty `study-*` containers.
- `python3 scripts/check-ai-context.py` validates AI context files and mirrored skills.

## Validation Expectations

- For UI changes, run at least `npm run typecheck:app`; use `npm run build` before handoff when practical.
- For API, auth, contract, or data changes, run `npm run typecheck:api` or `npm run build`.
- For Cosmos changes, run `npm run --prefix api cosmos:inspect`.
- For deployed changes, smoke test production `/api/grades` and `/api/grades/grade-10/study-payload`.
