# /verify-deploy

Verify the deployed Static Web App.

1. Use the production default URL unless the user provides another target:
   - `https://lemon-sea-0fb218010.7.azurestaticapps.net`
2. Run:
   - `curl -sS <target>/api/grades`
   - `curl -sS <target>/api/grades/grade-10/study-payload`
   - `curl -sS -o /tmp/sc-auth-me.json -w "%{http_code}" <target>/api/auth/me`
3. Expected unauthenticated `/api/auth/me` status is `401`.
4. If checking Cosmos-backed production state, run `npm run --prefix api cosmos:inspect` only when credentials are available.
5. Report target, statuses, and any failed endpoint.
