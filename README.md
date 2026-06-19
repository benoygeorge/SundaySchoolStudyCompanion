# Sunday School Study Companion

Static Vite app for loading grade-specific study questions and reference links from JSON files.

## What’s in the repo

- `public/data/grade-index.json` is the manifest that tells the app which grade files exist.
- `public/data/grades/grade-10.json` is the starter Grade 10 data file with questions and references together.
- `src/main.ts` renders the study companion UI and loads the JSON data at runtime.

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

## Build for static hosting

Run the production build with:

```bash
npm run build
```

The built output is written to `dist/`, which is suitable for Azure Static Web Apps or any static host.

## Add another grade

1. Create a new file in `public/data/grades/`.
2. Add the new grade entry to `public/data/grade-index.json`.
3. Keep the grade’s questions and references in the same JSON file unless you have a strong reason to split them later.

## Static hosting notes

- `staticwebapp.config.json` is included so route fallback works on Azure Static Web Apps.
- This app does not require a backend. Everything is served as static assets.