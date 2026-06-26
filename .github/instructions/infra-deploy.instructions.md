---
applyTo: "scripts/**/*,api/scripts/**/*,staticwebapp.config.json,.env.example"
---

# Infra And Deployment Instructions

- Use `npm run deploy:azure` for routine production publishes.
- Dedicated Azure resources belong in `rg-sundayschool-studycompanion-central`; shared Cosmos account `exam-cosmosdb` is the intentional exception.
- Never print, commit, or summarize app setting values, Cosmos keys, session secrets, or deployment tokens.
- Production mutations, deploys, DNS updates, Cosmos seed/migrate/prune, and broad data changes require explicit user confirmation immediately before execution.
- Preserve Azure Static Web Apps managed `/api` and navigation fallback behavior.
- Validate AI context with `python3 scripts/check-ai-context.py`; validate app changes with `npm run typecheck`, `npm run build`, and `npm run --prefix api build` as relevant.
