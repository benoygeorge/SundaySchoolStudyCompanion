# /lint

Check available linting/quality gates without inventing commands.

1. Inspect `package.json` and `api/package.json` scripts if needed.
2. State that this repo currently has no lint script, ESLint config, or Prettier config.
3. Run `npm run typecheck` as the available TypeScript quality gate.
4. Run `python3 scripts/check-ai-context.py` if AI context files changed.
5. Report that lint was unavailable unless a lint script has been added and executed.
