---
applyTo: "public/data/**/*"
---

# Static Data Instructions

- Static JSON is fallback/manual reference only, not production source of truth.
- Keep questions and references in the same per-grade JSON file.
- When adding a fallback grade, update `public/data/grade-index.json` and `public/data/grades/`.
- Use the current shared contract shape; do not preserve old compatibility fields by default.
- Persistent content changes should go through Cosmos/API workflows.
- Validate with `npm run build`; inspect Cosmos with `npm run --prefix api cosmos:inspect` after production data changes.
