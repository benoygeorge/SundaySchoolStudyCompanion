# Scripts Guidance

- `deploy-azure-static-webapp.sh` is the routine production deployment path. Use `npm run deploy:azure`, not ad-hoc deploy commands.
- `check-ai-context.py` validates agent/Copilot/Claude/Cursor context files. Run `python3 scripts/check-ai-context.py` after AI-context edits.
- Do not print secrets. Deployment tokens, Cosmos keys, session secrets, and app setting values must stay out of logs and docs.
- Production-mutating operations, including deploys and DNS changes, require explicit user confirmation immediately before execution.
- Keep scripts portable for macOS/Linux shell environments already used by this repo.
