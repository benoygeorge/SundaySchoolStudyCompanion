# /deploy

Deploy through the repo helper.

1. Read `AGENTS.md`, `ARCHITECTURE.md`, `README.md`, and `scripts/deploy-azure-static-webapp.sh`.
2. Run relevant validation first: `npm run typecheck`, `npm run build`, and `npm run --prefix api build`.
3. Confirm Azure CLI authentication and required app settings by name only when needed. Do not print setting values.
4. Immediately before deployment, ask the user to confirm the production mutation.
5. Run `npm run deploy:azure`.
6. Report the deploy command result and run `/verify-deploy` checks when deployment succeeds.

Use optional DNS env vars only when the user explicitly requests custom-domain automation.
