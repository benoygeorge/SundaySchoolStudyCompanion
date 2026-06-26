# Frontend Rules

- Read `src/AGENTS.md` and `docs/design.md` before UI, CSS, layout, copy, or interaction changes.
- Show an ASCII mock and wait for user confirmation before implementing a new UI feature.
- Keep browser data access in `src/api/*Client.ts` and on `/api`.
- Use `shared/studyContracts.ts` for response parsing and types.
- Do not render private identity fields or raw moderation/audit details in public/student views.
- Validate with `npm run typecheck:app`; run `npm run build` when routing, CSS, contracts, or API clients changed.
