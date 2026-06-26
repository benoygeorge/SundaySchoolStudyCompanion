# Data And Cosmos Rules

- Canonical containers are `study-content`, `study-comments`, and `study-ratings`.
- `public/data/` is fallback/manual reference only, not production source of truth.
- Keep fallback grade questions and references in the same per-grade JSON file and update `public/data/grade-index.json` when adding grades.
- Safe read command: `npm run --prefix api cosmos:inspect`.
- Require explicit user confirmation immediately before `cosmos:seed`, `cosmos:migrate-curriculum-schema`, or `cosmos:prune-study-containers`.
- Never print Cosmos keys, endpoints with credentials, app setting values, or deployment tokens.
