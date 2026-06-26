---
name: study-companion-api-data
description: Use when changing Study Companion Azure Functions, shared contracts, auth/session handling, role mapping, Cosmos schemas or queries, seed/prune scripts, static fallback behavior, privacy serializers, or API route contracts.
---

# Study Companion API/Data

## Required Context

Read these before editing:

- `AGENTS.md`
- `ARCHITECTURE.md`
- `shared/studyContracts.ts`
- Relevant files under `api/src/`

Use `rg` against `docs/plan.md` for the target workflow contract. Do not load the whole plan unless the task spans multiple workflows.

## Contract-First Flow

1. Update or confirm the Zod schema in `shared/studyContracts.ts`.
2. Keep API responses in the standard envelope: `{ success, data, message?, trace_id? }` or `{ success: false, error, trace_id? }`.
3. Shape public/student/teacher/admin responses with explicit serializers. Do not return raw Cosmos documents.
4. Update frontend clients only after the shared contract is stable.
5. Do not keep legacy field compatibility unless the user explicitly requests it. Prefer migrating JSON seeds, Cosmos documents, scripts, and UI to the current schema.

Current content model:

- Curriculum contains `books`, optional book `sections`, `chapters`, and `referenceLinks`.
- `chapter.bookId` is required; `chapter.sectionId` is optional.
- `question.chapterId` is required for study placement and filtering.
- `question.citations` is optional; citation targets are optional `bookId`, `chapterId`, and `referenceId` plus optional page range and excerpt.
- References use `resourceType`, `importance`, and `scope`; do not add free-text `category` fields.

## Cosmos Rules

Canonical containers:

- `study-content`, partition key `/gradeId`
- `study-comments`, partition key `/gradeId`
- `study-ratings`, partition key `/questionId`

Do not recreate old split containers such as `study-questions`, `study-curriculum`, `study-flags`, or `study-suggestions`.

Transactional batch rules from `docs/plan.md`:

- Question, curriculum, suggestion, flag, warning, archive, and content audit writes stay in the same `study-content` `gradeId` partition when atomicity is required.
- Comment moderation writes stay in the same `study-comments` `gradeId` partition.
- Rating writes use the `study-ratings` `questionId` partition.

## Auth And Privacy

- Browser login must proxy through `POST /api/auth/login`; the frontend must not call the Exam API.
- Browser sessions use encrypted `sc_session` HttpOnly cookies.
- JWTs must never be stored in local storage, session storage, or API response data.
- Protected browser writes need CSRF handling and Origin validation as the implementation matures.
- Public and student payloads must not expose personal profile fields, private review notes, audit records, or raw pending suggestion patches.

## Static Fallback

- Production should have `STUDY_DISABLE_STATIC_FALLBACK=true`.
- If fallback is disabled and Cosmos settings are missing, fail closed instead of serving stale JSON.
- Treat `public/data/` as manual reference and optional seed input, not production source of truth. Keep it on the current shared contract.

## Verification

Run the smallest useful check:

- `npm run typecheck:api` for API-only TypeScript edits.
- `npm run build` when shared contracts or frontend clients changed.
- `npm run --prefix api cosmos:inspect` after Cosmos script/schema/container changes.
- Production smoke test after deploy: `/api/grades` and `/api/grades/grade-10/study-payload`.
