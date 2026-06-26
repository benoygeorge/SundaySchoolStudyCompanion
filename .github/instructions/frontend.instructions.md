---
applyTo: "src/**/*,index.html,vite.config.ts"
---

# Frontend Instructions

- Read `src/AGENTS.md` plus `docs/design.md` before UI, CSS, layout, copy, or interaction changes.
- Before new UI feature implementation, show the user an ASCII mock and wait for confirmation.
- Keep all server access in `src/api/*Client.ts`; browser code calls `/api` only.
- Use shared schemas and types from `shared/studyContracts.ts`.
- Use TanStack Query for server state and preserve the existing BrowserRouter/static-hosting flow.
- Add loading, empty, error, success, and disabled states for async actions.
- Do not render private identity fields or raw moderation/audit details in public/student views.
- Validate with `npm run typecheck:app`; run `npm run build` when CSS, routing, shared contracts, or API clients change.
