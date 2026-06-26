---
name: sunday-school-study-companion-deployment-verification
description: 'Use when: verifying a Sunday School Study Companion deployment, checking production read endpoints, auth status behavior, or post-deploy Cosmos availability.'
---

# Sunday School Study Companion Deployment Verification

## Production Target

Default Static Web App URL:

```text
https://lemon-sea-0fb218010.7.azurestaticapps.net
```

## Commands

Read-only endpoint checks:

```bash
curl -sS https://lemon-sea-0fb218010.7.azurestaticapps.net/api/grades
curl -sS https://lemon-sea-0fb218010.7.azurestaticapps.net/api/grades/grade-10/study-payload
curl -sS -o /tmp/sc-auth-me.json -w "%{http_code}" https://lemon-sea-0fb218010.7.azurestaticapps.net/api/auth/me
```

Expected unauthenticated `/api/auth/me` status: `401`.

Cosmos read inspection, when credentials are available:

```bash
npm run --prefix api cosmos:inspect
```

## Reporting

- Report target URL, endpoint status, and schema/availability problems.
- Report app setting names only, never values, if configuration is checked.
- Do not run write endpoints or Cosmos mutations during verification.
