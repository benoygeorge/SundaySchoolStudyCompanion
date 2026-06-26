---
name: sunday-school-study-companion-deployment
description: 'Use when: deploying Sunday School Study Companion to Azure Static Web Apps, preparing a production publish, or changing deployment helper behavior.'
---

# Sunday School Study Companion Deployment

## Required Context

Read:

- `AGENTS.md`
- `ARCHITECTURE.md`
- `README.md`
- `scripts/deploy-azure-static-webapp.sh`
- `staticwebapp.config.json`

## Deployment Path

Routine production publish:

```bash
npm run deploy:azure
```

The helper runs the frontend build, API build, fetches the Static Web Apps deployment token, and deploys `dist/` plus `api/`.

## Safety

- Require explicit user confirmation immediately before running `npm run deploy:azure`.
- Do not print deployment tokens or app setting values.
- Dedicated Azure resources belong in `rg-sundayschool-studycompanion-central`.
- Shared Cosmos account `exam-cosmosdb` is the intentional exception.
- Use optional DNS environment variables only when the user asks for custom-domain automation.

## Reporting

- Report validation commands run before deploy.
- Report whether the deploy command completed.
- Recommend or run deployment verification after a successful deploy.
