---
applyTo: "api/**/*"
---

# API Instructions

- Read `api/AGENTS.md`, `ARCHITECTURE.md`, and relevant `docs/plan.md` sections before API/auth/Cosmos work.
- Keep Azure Function handlers in `api/src/functions/`, auth/session code in `api/src/auth/`, and store implementations in `api/src/data/`.
- Use the standard API envelopes from `api/src/http/responses.ts` and `shared/studyContracts.ts`.
- Browser auth must stay on Study Companion `/api/auth/*`; frontend code must not call the Exam API directly.
- Do not return raw Cosmos documents. Shape public/student/admin responses explicitly.
- Canonical containers are `study-content`, `study-comments`, and `study-ratings`.
- Validate with `npm run typecheck:api`; run `npm run --prefix api build` when API emit should be checked.
