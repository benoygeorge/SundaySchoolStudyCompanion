---
name: sunday-school-study-companion-prod-data-investigation
description: 'Use when: investigating Study Companion production data, inspecting Cosmos container state, comparing static fallback data with Cosmos-backed data, or diagnosing data availability without mutating production.'
---

# Sunday School Study Companion Production Data Investigation

## Read-Only Default

Start with read-only inspection:

```bash
npm run --prefix api cosmos:inspect
```

Use API smoke checks when deployed data availability is the question:

```bash
curl -sS https://lemon-sea-0fb218010.7.azurestaticapps.net/api/grades
curl -sS https://lemon-sea-0fb218010.7.azurestaticapps.net/api/grades/grade-10/study-payload
```

## Data Boundaries

- Production data should come from Cosmos through `/api`.
- `public/data/` is fallback/manual reference only.
- Canonical containers are `study-content`, `study-comments`, and `study-ratings`.
- Do not inspect or print secret values from `.env` or Azure app settings.

## Mutations

These commands mutate data and require explicit user confirmation immediately before execution:

```bash
npm run --prefix api cosmos:seed
npm run --prefix api cosmos:migrate-curriculum-schema
npm run --prefix api cosmos:prune-study-containers
```

## Reporting

- Report container names, counts, grades, and missing/extra Study Companion containers.
- State whether findings came from Cosmos, deployed API responses, or static JSON.
- Do not include user personal data or secret values in the report.
