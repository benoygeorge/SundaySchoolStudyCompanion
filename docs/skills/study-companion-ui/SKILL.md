---
name: study-companion-ui
description: Use when changing Sunday School Study Companion frontend screens, layouts, styling, React state, loading/error states, responsive behavior, accessibility, or UI copy in src/, src/styles.css, or docs/design.md.
---

# Study Companion UI

## Required Context

Read these before editing:

- `AGENTS.md`
- `ARCHITECTURE.md`
- `docs/design.md`
- Relevant files under `src/`

Use `docs/plan.md` only when the UI change depends on auth, role, privacy, moderation, or API behavior.

## Workflow

1. Identify the user role and workflow being changed: anonymous study, student study, teacher review, admin, or account.
2. Keep all data access behind `src/api/*Client.ts`; do not fetch Cosmos or the Exam API from UI code.
3. Prefer shared contract types from `shared/studyContracts.ts`.
4. Preserve static-hosting compatibility: new client views must work with Azure Static Web Apps navigation fallback.
5. Keep public and student views privacy-safe. Do not render names, user IDs, email, phone, school IDs, private notes, raw pending patches, or audit details.
6. Match `docs/design.md`: dense but readable screens, no marketing hero, no nested cards, complete mobile workflows.
7. Add explicit loading, empty, error, and disabled states for any async workflow.
8. Keep responsive constraints stable so buttons, filters, badges, and question cards do not shift or overlap.

## Implementation Preferences

- Keep app-level orchestration in `src/App.tsx` until a component split clearly reduces complexity.
- Keep fetch/parse behavior in `src/api/`.
- Use TanStack Query for server state.
- Keep browser session credentials out of local storage. Only the CSRF token may be JavaScript-readable.
- Use semantic HTML for forms, labels, buttons, and status text before adding custom controls.

## Verification

Run the smallest useful check:

- `npm run typecheck:app` for UI-only TypeScript changes.
- `npm run build` before handoff when CSS, routing, shared contracts, or API clients changed.

For substantial visual changes, run the app and inspect mobile and desktop viewports before handoff.
