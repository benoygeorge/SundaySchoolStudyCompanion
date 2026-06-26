# /test

Run the smallest useful project validation.

1. Read `AGENTS.md` and relevant scoped `AGENTS.md` files.
2. If AI context files changed, run `python3 scripts/check-ai-context.py`.
3. Run `npm run typecheck`.
4. Run `npm run build` unless the change is clearly docs-only.
5. Run `npm run --prefix api build` when API code, shared contracts, deployment, or Function output changed.
6. Run `npm run --prefix api cosmos:inspect` only for Cosmos schema/script/data work and only when the required local settings are available.
7. Report commands run, pass/fail status, key failure lines, and skipped checks with reasons.

Do not claim unit tests ran; no dedicated test runner is currently configured.
