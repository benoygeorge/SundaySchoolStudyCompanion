# Cosmos Script Guidance

- These scripts operate on Study Companion Cosmos containers and may affect production data when `.env` or Azure settings point at production.
- Safe read command: `npm run --prefix api cosmos:inspect`.
- Mutating commands require explicit user confirmation immediately before execution: `npm run --prefix api cosmos:seed`, `npm run --prefix api cosmos:migrate-curriculum-schema`, and `npm run --prefix api cosmos:prune-study-containers`.
- Canonical containers are `study-content`, `study-comments`, and `study-ratings`. Do not recreate old split containers.
- Never echo Cosmos endpoint, key, database secrets, or deployment tokens.
