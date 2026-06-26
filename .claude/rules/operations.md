# Operations Rules

- Use `npm run deploy:azure` for routine publishes.
- Dedicated Azure resources belong in `rg-sundayschool-studycompanion-central`; shared Cosmos account `exam-cosmosdb` is the intentional exception.
- Do not bypass `scripts/deploy-azure-static-webapp.sh` for routine deploys unless fixing or documenting a helper limitation.
- Production deploys, DNS updates, and production data mutations require explicit user confirmation immediately before execution.
- Post-deploy verification should check `/api/grades`, `/api/grades/grade-10/study-payload`, and unauthenticated `/api/auth/me` returning `401`.
