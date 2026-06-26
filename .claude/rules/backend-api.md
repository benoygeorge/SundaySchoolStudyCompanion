# Backend API Rules

- Read `api/AGENTS.md`, `ARCHITECTURE.md`, and relevant `docs/plan.md` sections before API/auth/Cosmos changes.
- Use shared Zod contracts first, then update handlers, data stores, frontend clients, source data, and docs.
- Keep response envelopes consistent with `api/src/http/responses.ts`.
- Browser auth goes through Study Companion `/api/auth/*`; raw Exam JWTs must not reach browser-readable storage.
- Return explicit public/student/admin shapes; never raw Cosmos documents.
- Validate with `npm run typecheck:api` and `npm run --prefix api build` when API output matters.
