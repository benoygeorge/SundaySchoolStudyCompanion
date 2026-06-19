# Repository Guidance

- This repo is a static Vite app for Sunday School Study Companion.
- Grade data lives under `public/data/grades/` and is loaded by `public/data/grade-index.json`.
- Keep questions and references together in the same per-grade JSON file unless there is a strong reason to split them later.
- Preserve static-hosting compatibility; any new routes should still work with Azure Static Web Apps fallback behavior.
- Prefer small, local edits and keep the UI responsive on mobile and desktop.
- When adding a new grade, update both the grade JSON file and the grade index.