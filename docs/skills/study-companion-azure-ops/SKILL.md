---
name: study-companion-azure-ops
description: Use when deploying, configuring Azure Static Web Apps, checking app settings, validating resource groups, pruning Study Companion Cosmos containers, smoke testing production /api routes, or diagnosing deployed Azure behavior.
---

# Study Companion Azure Ops

## Required Context

Read these before operating:

- `AGENTS.md`
- `ARCHITECTURE.md`
- `README.md`
- `scripts/deploy-azure-static-webapp.sh`
- `staticwebapp.config.json`

Use `docs/plan.md` deployment sections only when changing the Azure architecture.

## Resource Boundary

Dedicated resources for this repo must be in:

```text
rg-sundayschool-studycompanion-central
```

Expected dedicated resource:

- Static Web App `sundayschool-studycompanion`

Intentional exception:

- Shared Cosmos DB account `exam-cosmosdb` and database `exam-cosmosdb` remain outside this resource group.

Do not create ad-hoc Azure resources in other resource groups. If a new Azure resource is required, update `docs/plan.md` and `ARCHITECTURE.md`.

## Secrets

- Store local secrets in `.env`.
- Store production secrets in Static Web Apps app settings.
- Never print, commit, or summarize secret values.
- When verifying settings, list names only.

Required app setting names:

- `COSMOS_DATABASE_ID`
- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `STUDY_DISABLE_STATIC_FALLBACK`
- `STUDY_SESSION_SECRET`
- `EXAM_AUTH_BASE_URL`
- `STUDY_COOKIE_SECURE`

## Deployment

Use:

```bash
npm run deploy:azure
```

The helper builds the frontend, builds the API, gets the Static Web App deployment token, and deploys `dist/` plus `api/`.

Do not bypass the helper for routine publishes. If the helper fails, fix the helper or document the reason for a one-off command.

## Cosmos Operations

Use:

```bash
npm run --prefix api cosmos:inspect
npm run --prefix api cosmos:seed
npm run --prefix api cosmos:prune-study-containers
```

Only `study-content`, `study-comments`, and `study-ratings` should remain for Study Companion. The prune command is guarded and deletes only non-canonical `study-*` containers.

## Smoke Tests

After deploy or app-setting changes:

```bash
curl -sS https://lemon-sea-0fb218010.7.azurestaticapps.net/api/grades
curl -sS https://lemon-sea-0fb218010.7.azurestaticapps.net/api/grades/grade-10/study-payload
curl -sS -o /tmp/sc-auth-me.json -w "%{http_code}" https://lemon-sea-0fb218010.7.azurestaticapps.net/api/auth/me
```

Expected unauthenticated auth check: `401`.

Known external blocker: Exam login may return `Security verification failed. Please refresh the page and try again.` until the recaptcha/IP bypass or token flow accepts this execution path.
