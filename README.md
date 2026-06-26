# Sunday School Study Companion

React/Vite study companion with an Azure Static Web Apps managed API. The API reads grade-specific study content from Cosmos DB, while the checked-in JSON files remain the static compatibility fallback and manual content reference.

## What’s in the repo

- `AGENTS.md` and `docs/context-map.md` tell future coding agents what to read for each type of task.
- `ARCHITECTURE.md` describes the current implemented system.
- `public/data/grade-index.json` is the static fallback manifest that tells the app which grade files exist.
- `public/data/grades/grade-1.json` through `grade-9.json` are empty current-schema curriculum shells.
- `public/data/grades/grade-10.json` is the starter Grade 10 fallback data file with questions and references together.
- `src/main.tsx` renders the React study companion UI.
- `api/src/functions/` contains the Azure Functions handlers served under the Static Web Apps `/api` route.
- `shared/studyContracts.ts` contains shared API contracts used by the frontend and API.

## Content model

- A grade owns books, optional book sections, chapters, questions, and references.
- Every chapter belongs to a book; sections are optional.
- Every question uses `chapterId` for placement and study-session filtering.
- Citations are optional and can point to a book, chapter, reference, page range, and excerpt.
- References use `resourceType`, `importance`, and `scope` instead of a free-text category.

## Get a file from this repo

If you want a specific file from the repository, use one of these approaches:

1. Clone the repo and read the file locally:
   ```bash
   git clone https://github.com/benoygeorge/SundaySchoolStudyCompanion.git
   cd SundaySchoolStudyCompanion
   ```

2. Open the file directly in the repo after cloning, for example:
   - `public/data/grades/grade-10.json`
   - `public/data/grade-index.json`

3. If you only need the raw file, use the GitHub raw URL pattern after the repo is published:
   - `https://raw.githubusercontent.com/benoygeorge/SundaySchoolStudyCompanion/main/public/data/grades/grade-10.json`

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the dev server:
   ```bash
   npm run dev
   ```

3. Open the local URL shown by Vite in your browser.

For local API development, copy `.env.example` to `.env` and provide the Cosmos, Exam API, and session settings. Keep real secrets in `.env`; it is ignored by git.

## Study session flow

After the app loads a grade, use the setup panel to:

1. Pick how many questions to include.
2. Select or clear the chapters you want in the session.
3. Click `Start Study Session` to refresh the visible question bank.

This mirrors the original grade 10 study companion flow while keeping the app static-host friendly.

## Build for static hosting

Run the production build with:

```bash
npm run build
```

The frontend build output is written to `dist/`. The managed API is compiled under `api/dist/`.

## Deploy to Azure Static Web Apps

This repo is currently deployed to Azure Static Web Apps in:

- Resource group: `rg-sundayschool-studycompanion-central`
- Region: `centralus`
- Static Web App name: `sundayschool-studycompanion`

Use the deploy helper for future changes:

```bash
npm run deploy:azure
```

What it does:

1. Runs `npm run build`
2. Builds the managed API with `npm run --prefix api build`
3. Deploys `dist/` and `api/` to the configured Azure Static Web App production environment

Required production app settings are stored on the Static Web App, not in source control:

- `COSMOS_DATABASE_ID`
- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `STUDY_DISABLE_STATIC_FALLBACK`
- `STUDY_SESSION_SECRET`
- `EXAM_AUTH_BASE_URL`
- `STUDY_COOKIE_SECURE`

Dedicated Azure resources for this repo must stay in `rg-sundayschool-studycompanion-central`. The existing shared Cosmos DB account is intentionally outside this resource group; Study Companion data lives only in new `study-*` containers inside that shared account.

### Optional custom-domain automation

The same script can also update Route 53 and request custom-domain binding:

```bash
DOMAIN=sunday.benoy.net \
ROUTE53_ZONE_ID=Z03771873RZD17UBLU478 \
UPDATE_DNS=true \
ATTACH_CUSTOM_DOMAIN=true \
npm run deploy:azure
```

Notes:

- You must be logged into Azure CLI before deploying.
- For Route 53 updates, you must also be authenticated to AWS CLI.
- DNS propagation can take time; if domain attach validation is still pending, rerun the attach step later.

## Add another grade

1. Create a new file in `public/data/grades/`.
2. Add the new grade entry to `public/data/grade-index.json`.
3. Keep the grade’s questions and references in the same JSON file unless you have a strong reason to split them later.

## Static hosting notes

- `staticwebapp.config.json` is included so route fallback works on Azure Static Web Apps.
- The frontend stays static-hosting compatible. Dynamic auth and Cosmos-backed study reads are served by managed Static Web Apps API routes under `/api`.
