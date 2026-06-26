---
applyTo: "shared/**/*"
---

# Shared Contract Instructions

- Treat `shared/studyContracts.ts` as the source of truth for API and frontend shapes.
- Use Zod schemas and inferred TypeScript types rather than duplicate interfaces.
- Keep API response envelopes consistent.
- Public/student contracts must exclude user IDs, names, emails, phone numbers, school IDs, private notes, raw patches, and audit data.
- Contract changes usually require coordinated updates in `api/src/`, `src/api/`, `src/App.tsx`, `public/data/`, `api/scripts/study-cosmos.mjs`, `ARCHITECTURE.md`, and `docs/context-map.md`.
- Validate with `npm run typecheck`; use `npm run build` and `npm run --prefix api build` when consumers changed.
