# Shared Contract Guidance

- `studyContracts.ts` is the contract source for frontend and API.
- Prefer Zod schemas plus inferred TypeScript types over duplicate interfaces.
- Do not preserve legacy fields by default. When contracts change, update API route handlers, data stores, static fallback JSON, seed/migration scripts, docs, and UI together.
- Public/student schemas must not include user IDs, names, emails, phone numbers, school IDs, private notes, raw pending patches, or audit records.
- Keep API envelopes consistent with `apiSuccessSchema` and `apiErrorSchema`.
- Validate with `npm run typecheck`; use `npm run build` when frontend consumers changed and `npm run --prefix api build` when API emit changed.
