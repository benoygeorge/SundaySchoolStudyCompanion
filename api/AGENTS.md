# API Guidance

- Read `../AGENTS.md`, `../ARCHITECTURE.md`, and `../docs/plan.md` before changing API contracts, auth, Cosmos schemas, moderation workflows, or Azure architecture.
- Keep route handlers in `api/src/functions/`, auth/session behavior in `api/src/auth/`, and data access in `api/src/data/`.
- Start with `../shared/studyContracts.ts`; API responses must use the standard success/error envelope.
- Frontend/browser auth goes through Study Companion `/api/auth/*`; never expose raw Exam JWTs to browser-readable storage.
- Protected browser writes require the existing Study session proof and CSRF checks. Bearer tokens are for trusted non-browser clients only.
- Canonical Cosmos containers are `study-content` (`/gradeId`), `study-comments` (`/gradeId`), and `study-ratings` (`/questionId`).
- Return public/student/admin shapes through explicit serializers; do not return raw Cosmos documents.
- Production static fallback should be disabled. If fallback is disabled and Cosmos is missing, fail closed.
- Validate API-only edits with `npm run typecheck:api`; run `npm run --prefix api build` before handoff when API output matters.
