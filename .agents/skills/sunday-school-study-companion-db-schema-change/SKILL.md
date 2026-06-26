---
name: sunday-school-study-companion-db-schema-change
description: 'Use when: changing Study Companion Cosmos schemas, shared contracts, static seed data shape, migration scripts, or API serializers that read or write persisted study data.'
---

# Sunday School Study Companion DB Schema Change

## Context

Read:

- `AGENTS.md`
- `ARCHITECTURE.md`
- relevant `docs/plan.md` sections
- `shared/studyContracts.ts`
- `api/src/data/`
- `api/scripts/study-cosmos.mjs`

## Workflow

1. Update `shared/studyContracts.ts` first.
2. Update API data stores and serializers.
3. Update `public/data/` fallback files only as current-contract reference data.
4. Update `api/scripts/study-cosmos.mjs` for seed, inspect, or migration behavior.
5. Update frontend clients/UI if response shapes changed.
6. Update `ARCHITECTURE.md`, `docs/context-map.md`, and relevant agent instructions.

## Cosmos Rules

- Canonical containers: `study-content` (`/gradeId`), `study-comments` (`/gradeId`), `study-ratings` (`/questionId`).
- Do not recreate old split containers.
- Transactional content changes that must be atomic stay in the same grade partition.
- Production migrations or prune operations require explicit user confirmation immediately before execution.

## Validation

```bash
npm run typecheck
npm run build
npm run --prefix api build
npm run --prefix api cosmos:inspect
python3 scripts/check-ai-context.py
```

Report all commands run, failures, skipped credential-dependent checks, and any required manual production step.
