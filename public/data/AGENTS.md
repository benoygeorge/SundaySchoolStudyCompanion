# Static Fallback Data Guidance

- Static JSON is compatibility fallback and manual reference, not production persistence.
- Keep each grade's questions and references together in `public/data/grades/<grade-id>.json`.
- When adding a fallback grade, update both `public/data/grades/` and `public/data/grade-index.json`.
- Data must follow the current schemas in `shared/studyContracts.ts`; do not carry old compatibility fields forward.
- New persistent content should be entered through Cosmos/API workflows, not by treating JSON as the source of truth.
- Validate data shape indirectly with `npm run typecheck` and `npm run build`; use `npm run --prefix api cosmos:inspect` after Cosmos-backed content changes.
