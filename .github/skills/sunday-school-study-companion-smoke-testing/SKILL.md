---
name: sunday-school-study-companion-smoke-testing
description: 'Use when: smoke testing the Sunday School Study Companion frontend or API locally or in production, checking deployed read endpoints, or reporting endpoint availability.'
---

# Sunday School Study Companion Smoke Testing

## Local Checks

For frontend-only smoke checks:

```bash
npm run build
npm run preview
```

For development iteration:

```bash
npm run dev
```

The repo does not currently define a local Static Web Apps API emulator script.

## Production API Checks

Use read-only endpoints:

```bash
curl -sS https://lemon-sea-0fb218010.7.azurestaticapps.net/api/grades
curl -sS https://lemon-sea-0fb218010.7.azurestaticapps.net/api/grades/grade-10/study-payload
curl -sS -o /tmp/sc-auth-me.json -w "%{http_code}" https://lemon-sea-0fb218010.7.azurestaticapps.net/api/auth/me
```

Expected unauthenticated `/api/auth/me` status: `401`.

## Reporting

- Report the target environment and URL.
- Include HTTP status, whether JSON parsed, and the key failure message when an endpoint fails.
- Do not run write endpoints, authenticated login, deploys, or data mutations unless explicitly requested.
