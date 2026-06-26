---
applyTo: "package.json,api/package.json,tsconfig.json,api/tsconfig.json,vite.config.ts,scripts/check-ai-context.py"
---

# Validation Instructions

- Existing scripts are the authority. Do not invent lint or test commands.
- Current validation commands:
  - `python3 scripts/check-ai-context.py`
  - `npm run typecheck`
  - `npm run build`
  - `npm run --prefix api build`
  - `npm run --prefix api cosmos:inspect`
- There is currently no lint script, ESLint config, unit test runner, or CI config in this repo.
- Report exactly which commands ran, which failed, and any commands skipped because prerequisites or credentials were unavailable.
