# /smoke-test

Smoke test the app or deployed API without mutating production data.

1. Ask or infer the target: local Vite preview/dev server or production Static Web App.
2. For local frontend checks, use `npm run dev` or `npm run preview` after `npm run build` when practical.
3. For production API checks, run:
   - `curl -sS https://lemon-sea-0fb218010.7.azurestaticapps.net/api/grades`
   - `curl -sS https://lemon-sea-0fb218010.7.azurestaticapps.net/api/grades/grade-10/study-payload`
   - `curl -sS -o /tmp/sc-auth-me.json -w "%{http_code}" https://lemon-sea-0fb218010.7.azurestaticapps.net/api/auth/me`
4. Expected unauthenticated `/api/auth/me` status is `401`.
5. Report target URL, endpoints checked, HTTP statuses, and any schema or availability problems.

Do not run write endpoints or authenticated login flows unless the user explicitly requests them and provides the required context.
