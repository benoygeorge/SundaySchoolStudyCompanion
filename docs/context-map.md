# Context Map

Use this file to choose the smallest context set that can answer the task.

## Always Read First

- `AGENTS.md`: repository operating rules.
- `ARCHITECTURE.md`: current implementation snapshot.

## Task Routing

| Task | Read next | Use skill |
| --- | --- | --- |
| UI, CSS, layout, copy, responsive behavior | `docs/design.md`, `src/App.tsx`, `src/styles.css` | `docs/skills/study-companion-ui/SKILL.md` |
| API route, shared contract, serializer, auth, role behavior | `docs/plan.md`, `shared/studyContracts.ts`, relevant `api/src/` files | `docs/skills/study-companion-api-data/SKILL.md` |
| Cosmos schema, seed data, container cleanup | `ARCHITECTURE.md`, `api/scripts/study-cosmos.mjs`, `api/src/data/` | `docs/skills/study-companion-api-data/SKILL.md` |
| Azure deployment, app settings, production smoke test | `README.md`, `scripts/deploy-azure-static-webapp.sh`, `staticwebapp.config.json` | `docs/skills/study-companion-azure-ops/SKILL.md` |
| AI context, Copilot, Claude, Cursor, skills | `AGENTS.md`, `ARCHITECTURE.md`, `scripts/check-ai-context.py`, relevant `.github/`, `.claude/`, `.agents/` files | `.agents/skills/sunday-school-study-companion-architecture-doc-maintenance/SKILL.md` |
| Product/target behavior decisions | `docs/plan.md` | Pick the relevant skill after reading the plan section |
| Design decisions | `docs/design.md` | `docs/skills/study-companion-ui/SKILL.md` |

## Useful Search Anchors

Use `rg` instead of reading all of `docs/plan.md` when only one area is relevant:

- `rg -n "GET /grades|study-payload|Static Frontend" docs/plan.md`
- `rg -n "POST /auth/login|Browser session|CSRF|Role mapping" docs/plan.md`
- `rg -n "study-content|study-comments|study-ratings|partition" docs/plan.md`
- `rg -n "Suggestion|Comment|Flag|Audit" docs/plan.md`
- `rg -n "CORS And Deployment|resource group|deploy:azure" docs/plan.md`
- `rg -n "check-ai-context|skills|Copilot|Claude|Cursor" AGENTS.md ARCHITECTURE.md docs/context-map.md`

## Context Hygiene

- Prefer `ARCHITECTURE.md` for current facts; use `docs/plan.md` for target rules and future endpoints.
- Do not load generated folders such as `dist/`, `node_modules/`, `api/dist/`, or coverage output.
- Do not read `.env` unless the task explicitly requires local secret-backed verification. Never echo secret values.
- Treat `public/data/` as fallback/reference content, not production persistence.
- Keep answers and changes tied to concrete files and commands.
