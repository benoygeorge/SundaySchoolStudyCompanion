# Frontend Guidance

- Read `../AGENTS.md`, `../ARCHITECTURE.md`, and `../docs/design.md` before UI, CSS, copy, layout, or interaction changes.
- Before implementing a new UI feature, show the user an ASCII mock and wait for confirmation.
- Keep browser calls in `src/api/*Client.ts` and on the Study Companion origin (`/api`). Do not call the Exam API from frontend code.
- Use shared types and Zod response schemas from `../shared/studyContracts.ts`.
- Do not store or render raw JWTs, user IDs, names, emails, phone numbers, school IDs, private notes, raw pending patches, or audit records in public/student views.
- Use TanStack Query for server state. Add explicit loading, empty, error, success, and disabled states for async workflows.
- Preserve Azure Static Web Apps static routing compatibility.
- Validate frontend-only changes with `npm run typecheck:app`; use `npm run build` when routing, shared contracts, CSS, or API clients changed.
