# Repository Guidance

- This repo is a static Vite app for Sunday School Study Companion.
- Grade data lives under `public/data/grades/` and is loaded by `public/data/grade-index.json`.
- Keep questions and references together in the same per-grade JSON file unless there is a strong reason to split them later.
- Preserve static-hosting compatibility; any new routes should still work with Azure Static Web Apps fallback behavior.
- Prefer small, local edits and keep the UI responsive on mobile and desktop.
- When adding a new grade, update both the grade JSON file and the grade index.
- Azure deployment for this repo uses a dedicated resource group: `rg-sundayschool-studycompanion-central` (Central US).
- Use `npm run deploy:azure` for routine publishes of UI/content changes.
- Deployment helper script is `scripts/deploy-azure-static-webapp.sh` and can optionally update Route 53 plus request custom domain attach.