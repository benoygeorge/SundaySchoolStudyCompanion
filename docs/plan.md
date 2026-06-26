# Sunday School Study Companion Platform Plan

## 1. Purpose And Constraints

The Sunday School Study Companion should remain fast, inexpensive to operate, and safe for curriculum use. The frontend should keep its static-hosting behavior, but the target implementation stores curriculum and question data in Cosmos DB rather than per-grade JSON files. The static frontend reads public-safe study payloads from the Study Companion API; dynamic APIs handle authentication, teacher contributions, ratings, comments, flags, suggestion workflows, audit review, and cache invalidation.

Core decisions:

- Content is global across all schools and parishes.
- Cosmos DB is the target source of truth for grade, chapter, question, rating, comment, flag, suggestion, and audit data.
- Current per-grade JSON files are a static compatibility fallback and manual entry reference, not the target persistence model.
- `unrated` questions are visible by default with an unrated badge.
- Teacher-created questions publish immediately as `unrated`.
- Suggested edits and citations stay pending until approved by two other teachers or resolved by an Admin.
- Student suggestions are advisory until teachers approve them.
- Flagged questions remain visible with a warning badge unless archived by an Admin.
- Teacher and student ratings are stored and displayed separately.
- Public and anonymous responses must never expose user IDs, names, emails, phone numbers, or other personal profile data.
- Approved public comments may be shown to anonymous users and students, but author identity is redacted from public and student views.
- Student profiles are minimal in this app; v1 does not include classroom analytics or long-term student performance dashboards.
- Browser sessions use a Study Companion HttpOnly, Secure, SameSite cookie that contains an encrypted Exam JWT. The browser UI must not store the JWT in local storage or expose it to JavaScript.
- Non-browser/server clients means future trusted callers such as API smoke-test scripts, CLI/admin maintenance scripts, CI jobs, scheduled jobs, or backend integrations. These clients may use `Authorization: Bearer <token>`; the normal student, teacher, and Admin browser UI uses the secure cookie.
- Admin users may approve, reject, or archive any pending or disputed public comment.
- Teacher approval remains global across all schools, parishes, and grades for v1.
- Comment and audit workflows must be partitioned by `gradeId` to support grade-based teacher/Admin queues.
- Suggestion incorporation must be atomic: the target question, suggestion review state, and incorporation audit entry must be written in one Cosmos transactional batch within the same grade partition.
- V1 has no automated JSON-to-Cosmos migration. Existing JSON files remain static compatibility/fallback artifacts; target Cosmos content is entered through the Study Companion UI.
- V1 must include Admin UI and API support for creating and maintaining grades, books, optional book sections, chapters, and reference links so the system can be bootstrapped without JSON import or direct Cosmos edits.
- UI implementation must follow `docs/design.md`; this plan owns architecture/API/data decisions, while `docs/design.md` owns UI consistency, navigation, component behavior, responsive rules, and copy conventions.
- The system should favor low recurring operational cost over paid SLA until traffic or operational needs justify an upgrade.

Recommended low-cost Azure stack:

- All dedicated Azure resources for this repository must be created in the dedicated resource group `rg-sundayschool-studycompanion-central` in Central US unless an explicit architecture review approves an exception.
- Azure Static Web Apps for the static frontend, preferably on the Free plan while traffic and SLA requirements remain modest.
- Managed Azure Functions APIs under the Static Web Apps `/api` route for v1, where the API constraints fit. This keeps one public origin, avoids browser CORS complexity, and avoids creating a separate Functions resource unless needed.
- A separate Azure Functions Consumption app is the fallback only if managed Static Web Apps APIs cannot support an implementation requirement such as non-HTTP triggers, a separately deployed API lifecycle, or request duration beyond Static Web Apps API limits.
- Existing shared Azure Cosmos DB account `exam-cosmosdb`, using new Study Companion containers prefixed `study-*` inside the existing Cosmos DB SQL API database resource currently named `exam-cosmosdb`.
- Existing shared Redis instance, using Study Companion-specific key prefixes and TTL rules.
- Azure Storage is not required for v1 study payload publication because content is served by API from Cosmos DB.
- Avoid Azure API Management, Front Door, separate storage publication, or Standard Static Web Apps unless a later scale, SLA, custom authentication, private networking, or traffic requirement justifies the added cost.

Useful pricing references:

- Azure Static Web Apps pricing: <https://azure.microsoft.com/en-us/pricing/details/app-service/static/>
- Azure Functions pricing: <https://azure.microsoft.com/en-us/pricing/details/functions/>
- Azure Cosmos DB free tier: <https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier>

Recommended implementation stack:

- Frontend: React with TypeScript, Vite, React Router, and a query/cache library such as TanStack Query.
- API for v1 low-cost deployment: TypeScript Azure Functions under the Static Web Apps managed `/api` route.
- Shared contracts: TypeScript schemas such as Zod or TypeBox for API request/response validation and frontend type inference.
- Styling: component-level CSS or a small design-token layer aligned with `docs/design.md`; avoid a large UI framework unless it clearly speeds up teacher/admin tables and forms without fighting the design guide.

Why this stack is recommended for v1:

- The frontend must run in the browser, so TypeScript remains useful even when starting fresh.
- The API is mostly HTTP CRUD, workflow validation, serialization, and calls to Cosmos DB, Redis, and Exam auth; TypeScript handles this well with low operational overhead.
- Using TypeScript on both sides makes the many role-shaped serializers, public-safe payload contracts, and moderation workflow types easier to share and test.
- Static Web Apps managed `/api` keeps the lowest-cost deployment path simple.

Alternatives:

| Stack | When to choose it | Tradeoffs |
| --- | --- | --- |
| React + TypeScript frontend, TypeScript Azure Functions API | Recommended v1 default for low cost, shared contracts, and managed Static Web Apps APIs. | Less backend structure than .NET unless the project establishes clear modules and validation patterns. |
| React + TypeScript frontend, .NET isolated Azure Functions API | Choose if backend complexity, strict service boundaries, dependency injection, and long-term Azure enterprise patterns matter more than shared frontend/backend language. | More project/setup complexity, no shared TypeScript contracts without OpenAPI generation, and may push sooner toward a separate Functions app. |
| React + TypeScript frontend, Python Azure Functions API | Choose only if future work becomes content-processing or data-science heavy. | Weaker fit for type-safe API contracts and larger workflow-heavy admin surfaces. |
| Full-stack framework such as Next.js | Choose if server-rendering, edge rendering, or integrated full-stack routing becomes important. | Less aligned with the current low-cost Static Web Apps managed `/api` plan and may add deployment complexity. |

Recommended first implementation slices:

1. Foundation: convert the frontend to React/TypeScript, add React Router, add a Static Web Apps-compatible TypeScript Functions API scaffold, add shared request/response schemas, and keep the existing static JSON files as a temporary fallback.
2. Read path and auth shell: implement `GET /grades`, `GET /grades/{gradeId}/study-payload`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, encrypted browser cookies, CSRF handling, and role mapping.
3. Admin curriculum bootstrap and question authoring: implement grade curriculum maintenance, teacher/Admin question creation, authoring question lists, and Admin user role visibility so Cosmos content can be entered without direct database edits.
4. Ratings and comment moderation: implement rating summaries, comment submission, teacher review, Admin comment resolution, and public-safe comment serializers.
5. Flags, suggestions, audit, and cache controls: implement warning workflows, suggestion detail/review/resolution, audit reads, cache invalidation, and the remaining Admin screens.

Each slice must ship with API contract tests, role/privacy serializer tests, and mobile/desktop UI checks against `docs/design.md`. Do not start broad UI screens for a slice until that slice's API contracts and shared schemas are in place.

## 2. Architecture

### Static Frontend And API Read Path

The static frontend loads study data through the Study Companion API:

- `GET /grades`
- `GET /grades/{gradeId}/study-payload`
- Optional authenticated calls for personal rating, comment, flag, and suggestion actions.

The API study payload is the canonical student study payload. It includes grade metadata, chapters, questions, references, rating aggregates, warning badges, approved public comments, public-safe suggestion summaries, and citation summaries needed for study. The current static JSON files may be used as a temporary static fallback or manual entry reference, but v1 does not include automated JSON import. Target content reads come from Cosmos DB through the API after content is entered through the Study Companion UI.

The public and student study payload excludes:

- Archived questions.
- Private author, rater, commenter, approving teacher, admin, and flagger identity fields.
- Private review notes and audit records.
- Rejected, withdrawn, or admin-only suggestions.

### Dynamic API Path

Dynamic APIs are used for:

- Login and token validation through the existing Exam auth API, called by the Study Companion API server-to-server.
- Student and teacher ratings.
- Optional comments.
- Flags and warning resolution.
- Teacher question creation.
- Citation submission.
- Edit suggestions.
- Teacher peer approval and rejection.
- Admin dispute resolution, comment moderation, audit review, archiving, and cache invalidation.

All new app API responses use this envelope:

```json
{
  "success": true,
  "data": {},
  "message": "Optional message",
  "trace_id": "..."
}
```

Errors use:

```json
{
  "success": false,
  "error": "Error message",
  "trace_id": "..."
}
```

Non-browser/server clients are trusted callers outside the browser UI, such as API smoke-test scripts, CLI/admin maintenance scripts, CI jobs, scheduled jobs, or backend integrations. They may use:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

For browser sessions, the v1 implementation uses an HttpOnly, Secure, SameSite cookie issued by the Study Companion API after `POST /auth/login`. The cookie contains an encrypted Exam JWT and is the only browser session credential. The frontend must not store the JWT in browser local storage, session storage, or any JavaScript-readable state. Protected write requests must also use an anti-CSRF header or token and server-side Origin checks.

The Study Companion frontend should call the Study Companion API for protected operations. The Study Companion API decrypts the cookie credential for browser requests, accepts bearer tokens only from non-browser/server clients, and validates the resulting Exam JWT server-to-server with the Exam auth API. The frontend should not call the Exam auth API directly unless a later CORS review explicitly approves that browser integration.

Public REST APIs remain domain-specific, such as `/questions`, `/ratings`, and `/flags`. Generic reuse should be implemented as internal storage and auth helper modules, not as public generic Cosmos DB or Redis CRUD endpoints. This keeps Study Companion business logic out of the Exam system without creating a broad shared data gateway.

Grade-partitioned entity route rules:

- Any endpoint that reads or writes an existing grade-partitioned entity by ID must receive `gradeId` explicitly, either in the path, query string for reads, or JSON body for writes.
- The API must treat `gradeId` from the client as a routing and authorization hint, then verify that the stored entity's `gradeId` matches before returning or mutating data. A mismatch should return a not-found style response rather than leaking that the entity exists under another grade.
- Entity IDs may include grade-like text for readability, but ID parsing is not authoritative and must not replace explicit `gradeId` validation.
- Transactional batches for questions, curriculum, suggestions, flags, warning state, and related audit entries use the supplied and verified `gradeId` partition in `study-content`.
- Transactional batches for comments and comment audit entries use the supplied and verified `gradeId` partition in `study-comments`.
- Rating writes use the `questionId` partition in `study-ratings`, but rating endpoints that can create comment moderation records also require `gradeId` so the comment record can be written to the correct `study-comments` partition and the affected study-payload cache can be invalidated.

Token validation rules:

- Protected writes call Exam `POST /auth/verify-token` from the Study Companion API before accepting the request.
- The Study Companion API may cache successful token validation briefly in Redis by a hash of the token, never by the raw token value.
- Token validation cache entries must be short-lived so Exam-side token revocation and auth token version checks remain authoritative.

Browser session and CSRF rules:

- The Study Companion cookie should use a dedicated name such as `sc_session`, with `HttpOnly`, `Secure`, `SameSite=Lax` or stricter, path scoped to the Study Companion origin, and an expiration no later than the Exam JWT expiration.
- The encrypted cookie payload should include the Exam JWT, issued-at time, expiration time, key ID, and a random nonce. Encrypt with authenticated encryption such as AES-GCM or an equivalent vetted platform primitive.
- Encryption keys live in Static Web Apps/Functions app settings for v1 or Key Vault if the deployment moves secrets out of app settings. Key rotation must support at least one previous key for decrypt-only during a rollout window.
- Protected browser writes require an anti-CSRF token that is not HttpOnly, paired with the HttpOnly session cookie, plus server-side `Origin` validation against the Study Companion origin.
- Non-browser/server bearer-token clients do not use CSRF tokens, but they still go through Exam token validation and role mapping.

## 3. Auth And Roles

The new app reuses the existing Exam auth API. JWT is the portable credential for a separate Azure app. Flask session cookies may exist in the Exam app, but the Study Companion should rely on Exam JWT validation. Browser users receive the JWT only as an encrypted value inside the Study Companion HttpOnly session cookie; non-browser/server clients may pass the JWT as a bearer token.

Production base URL:

```text
https://api-exam.msossa.org/api
```

Alternate production base URL:

```text
https://api-exam-msossa-org.benoy.net/api
```

Role mapping:

| Exam auth `user_type` | New app role |
| --- | --- |
| `admin` | `Admin` |
| `school-admin`, `school_admin`, `School Admin` | `Teacher` |
| `student`, `Student` | `Student` |
| `evaluator` | No access unless explicitly mapped later |

Recommended normalization:

```js
function mapRole(userType) {
  const role = String(userType || '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

  if (role === 'admin') return 'Admin';
  if (role === 'school-admin') return 'Teacher';
  if (role === 'student') return 'Student';
  return null;
}
```

App roles:

| Capability | Anonymous | Student | Teacher | Admin |
| --- | --- | --- | --- | --- |
| Study visible content, including unrated questions | Yes | Yes | Yes | Yes |
| View aggregate ratings | Yes | Yes | Yes | Yes |
| View approved public comments without author identity | Yes | Yes | Yes | Yes |
| View comment author identity for moderation | No | No | Limited moderation context | Yes |
| Submit ratings | No | Yes | Yes | Yes |
| Submit optional comments for public-after-review display | No | Yes | Yes | Yes |
| Flag content | No | Yes | Yes | Yes |
| Create questions | No | No | Yes | Yes |
| Submit citations | No | Yes | Yes | Yes |
| Suggest edits | No | Yes | Yes | Yes |
| Approve peer suggestions | No | No | Yes | No |
| Approve public comments | No | No | Yes | Yes |
| Resolve disputed suggestions | No | No | No | Yes |
| Resolve warnings | No | No | No | Yes |
| Archive questions | No | No | No | Yes |
| View audit trail | No | No | No | Yes |
| Invalidate API/read-model caches | No | No | No | Yes |

Admin UI scope for v1:

- Review audit trail entries for question creation, incorporated suggestions, comment moderation, flag resolution, warning changes, and archives.
- View Study Companion role context for users surfaced by Study workflows, including mapped role, source Exam role, school, and grade where available.
- Moderate public comments by approving, rejecting, or archiving them.
- Resolve flags and set or clear warning badges.
- Review suggestions where teacher approvals conflict or alternate text proposals do not converge.
- Create and maintain grade curriculum metadata, books, optional book sections, chapters, and reference links.
- Force-edit or archive questions when needed for curriculum safety.
- Invalidate Redis/API read caches after manual corrections.
- Account creation, registration, password management, broad user profile editing, and automated JSON-to-Cosmos migration tooling stay out of v1. V1 Cosmos content entry happens through the Study Companion UI.

## 4. Data Model

Use the existing shared Cosmos DB account and the existing Cosmos DB SQL API database resource currently named `exam-cosmosdb`. Study Companion data must live in new dedicated containers prefixed `study-*`; it must not reuse or modify Exam-owned containers.

Cost and capacity note: the existing Cosmos DB SQL API database resource currently named `exam-cosmosdb` is configured with fixed shared throughput at `1000` RU/s, which aligns with the account's free-tier allocation. New `study-*` containers in that same database resource share the existing database-level RU/s pool rather than creating a separate database or account. Create a separate database or account only if a later architecture review identifies a hard isolation requirement that justifies the added cost.

Container naming:

| Logical model | Container |
| --- | --- |
| `Curriculum` | `study-content` |
| `Questions` | `study-content` |
| `Ratings` | `study-ratings` |
| `Comments` | `study-comments` |
| `Flags` | `study-content` |
| `Suggestions` | `study-content` |
| `AuditLog` | Entity-local audit documents in `study-content` for curriculum/question/suggestion/flag workflows and in `study-comments` for comment moderation workflows. |
| `UserRoleContext` | Admin-only lightweight user context documents in `study-content`, scoped by grade and sourced from Exam auth context observed during Study workflows. |

Target container partitioning:

- `study-content` with partition key `/gradeId`
- `study-ratings` with partition key `/questionId`
- `study-comments` with partition key `/gradeId`

Recommended indexing and TTL policy before application writes begin:

| Container | Indexing proposal | TTL proposal |
| --- | --- | --- |
| `study-content` | Selective indexing on `docType`, `gradeId`, `status`, `chapter`, `questionType`, `difficulty`, `warning.active`, `questionId`, `entityId`, `entityType`, `action`, `flagType`, `createdAt`, `updatedAt`, `resolvedAt`, `submittedBy.role`, approval counts, user role context fields, and conflict fields used by study, teacher, Admin, suggestion, flag, and audit workflows. Exclude large citation, history, explanation, and raw patch subtrees unless query requirements prove otherwise. | Disabled by default. Curriculum, questions, suggestions, flags, user role context, and content/flag audit entries are durable source-of-truth records. |
| `study-ratings` | Selective indexing on `docType`, `questionId`, `gradeId`, `userId`, `role`, and `updatedAt`. Do not pay to index aggregate text that is not queried. | Disabled by default. Ratings and per-question rating summary records are durable user data. |
| `study-comments` | Selective indexing on `docType`, `gradeId`, `questionId`, moderation state, visibility state, `entityId`, `entityType`, `action`, `createdAt`, and moderation fields. Partition by `gradeId` because teacher/Admin queues filter by grade, status, and approval count. Exclude long comment body text from indexing unless full-text style filtering becomes a real requirement. | Disabled by default. If comment redaction or purge is needed later, use per-item TTL rather than a container default. |

Atomic incorporation rule:

- The question document, suggestion document, and incorporation audit entry must all be stored in `study-content` with the same `gradeId` partition key so the API can use a Cosmos transactional batch.
- Incorporation writes must include optimistic concurrency checks such as the question `_etag` or `baseQuestionVersion`, plus an idempotency key so duplicate review submissions cannot apply the same patch twice.
- Redis cache invalidation happens only after the Cosmos batch commits. Cache invalidation must be idempotent and must never be treated as the source of truth for whether incorporation succeeded.
- If a future implementation adds separate audit or suggestion search projections, those projections are read models only. The v1 source of truth for incorporation audit state remains the `study-content` transactional write.

Entity-local audit rule:

- Audit entries must be written in the same container and `gradeId` partition as the entity state change when the operation needs an atomic audit trail.
- Question, curriculum, suggestion, flag, warning, archive, and cache-invalidation audit entries live in `study-content`.
- Comment moderation audit entries live in `study-comments` so comment status and comment audit can commit in the same transactional batch.
- `GET /admin/audit` is a grade-scoped merged read across the audited containers, sorted by `createdAt` and then `id`.

Rating aggregate rule:

- `study-ratings` stores one `docType: "rating"` document per `questionId` and user plus one `docType: "ratingSummary"` document per `questionId`.
- Saving a rating must use a transactional batch in the `questionId` partition to upsert the user's rating and update the rating summary from the previous rating values.
- Public APIs and study payload serializers read aggregate rating values from the summary document, not by scanning all rating documents on every request.
- The summary document stores counts and sums internally; serializers emit rounded averages and counts only.

Operational guidance for the first API rollout:

- Keep Cosmos automatic indexing enabled, but move the high-write containers to selective included and excluded paths before bulk writes begin.
- Do not use Cosmos TTL for auth or short-lived cache behavior; keep those workloads in Redis under the `study:{env}:` prefix.
- Apply and test indexing policy with realistic study, teacher queue, comment moderation, flag review, and suggestion approval queries before loading large question banks.

Redis rules:

- All Study Companion Redis keys must use the prefix `study:{env}:...`, where `{env}` is the deployment environment such as `local`, `dev`, `staging`, or `prod`.
- All transient Redis keys must have explicit TTLs.
- Cache and auth introspection entries must be short-lived.
- Code must not perform broad wildcard deletes outside the `study:{env}:` prefix.
- Study Companion code must not read, write, delete, scan, or infer Exam Redis keys.

Redis key helper requirement:

- Implement one central Redis key helper in the Study Companion API, for example `makeStudyRedisKey(...parts)`.
- The helper owns the `study:{env}:` prefix and validates each key segment before returning a key.
- Redis reads, writes, deletes, scans, locks, queues, and token-validation cache entries must use the helper rather than constructing keys inline.
- Any helper method that scans or deletes multiple keys must require a scoped suffix under `study:{env}:` and must not accept raw wildcard patterns.

### `UserRoleContext`

Purpose: Admin-only visibility into users who appear in Study Companion workflows, without taking ownership of Exam account management.

Partition key: `/gradeId`

Rules:

- Store one lightweight context document per `gradeId`, auth provider, and source user ID when a user logs in or performs a Study workflow for that grade.
- Exam remains the source of truth for account creation, password management, broad profile fields, and account status.
- Public, student, and teacher responses must never include these documents.
- Admin serializers may expose mapped Study role, source Exam role, school, grade, and last seen timestamps, but not password data, phone number, private profile notes, or editable Exam account fields.

Example:

```json
{
  "id": "userctx_grade-10_exam_34",
  "docType": "userRoleContext",
  "gradeId": "grade-10",
  "authProvider": "exam",
  "userId": "34",
  "role": "Teacher",
  "sourceRole": "school-admin",
  "schoolId": 12,
  "schoolName": "School Name",
  "sourceGrade": "10",
  "lastSeenAt": "2026-06-20T00:00:00Z",
  "updatedAt": "2026-06-20T00:00:00Z"
}
```

### `Curriculum`

Purpose: grade structure, official syllabus metadata, books, optional book sections, chapters, and reference links.

Partition key: `/gradeId`

Example:

```json
{
  "id": "grade-10-curriculum",
  "docType": "curriculum",
  "gradeId": "grade-10",
  "label": "Grade 10",
  "books": [
    {
      "id": "book_pt10",
      "role": "primary",
      "title": "Faith & Tradition: Grade 10",
      "edition": "2022"
    }
  ],
  "sections": [
    {
      "id": "faith-in-practice",
      "bookId": "book_pt10",
      "title": "Faith in Practice"
    }
  ],
  "chapters": [
    {
      "id": "18",
      "bookId": "book_pt10",
      "sectionId": "faith-in-practice",
      "title": "Christian Financial Stewardship"
    }
  ],
  "referenceLinks": [
    {
      "id": "orthodox-wiki-anaphora",
      "title": "Orthodox Wiki: Anaphora",
      "href": "https://example.org/anaphora",
      "resourceType": "website",
      "importance": "recommended",
      "scope": "chapter",
      "chapterId": "18"
    }
  ]
}
```

### `Questions`

Purpose: authoring source of truth for questions, answers, citations, status, warnings, version history, and private author metadata.

Partition key: `/gradeId`

Statuses:

- `unrated`: teacher-created, visible by default, and marked with an unrated badge.
- `published`: visible by default and accepted as stable content.
- `archived`: hidden from normal study payloads but retained for audit and rollback.

Warning state is separate from status. A question can be `published` with `warning.active: true`.

Supported authoring question types:

- `mcq`
- `true_false`
- `short_answer`
- `long_answer`
- `one_word`
- `hymn`
- `prayer`

Authoring question example:

```json
{
  "id": "q_grade10_018_001",
  "docType": "question",
  "gradeId": "grade-10",
  "status": "unrated",
  "questionType": "mcq",
  "chapterId": "18",
  "difficulty": "medium",
  "question": "According to the lesson, when does wealth become bad?",
  "options": [
    "When you save money instead of spending it all immediately",
    "When the role of money becomes distorted and takes a high priority in your life",
    "When you earn more than your basic needs require",
    "When you give money to charity"
  ],
  "answer": "When the role of money becomes distorted and takes a high priority in your life",
  "explanation": "The lesson warns against money taking a distorted priority in life.",
  "citations": [
    {
      "id": "cit_001",
      "sourceType": "book",
      "bookId": "book_pt10",
      "chapterId": "18",
      "page": "142",
      "excerpt": "The role of money becomes distorted...",
      "status": "approved"
    }
  ],
  "warning": {
    "active": false,
    "reason": null,
    "resolvedAt": null
  },
  "version": 1,
  "createdBy": {
    "authProvider": "exam",
    "userId": "34",
    "roleAtCreation": "Teacher",
    "schoolId": 12
  },
  "createdAt": "2026-06-20T00:00:00Z",
  "updatedAt": "2026-06-20T00:00:00Z"
}
```

### `Ratings`

Purpose: one current rating per user per question, plus optional comment text that enters the same public-after-review moderation flow as standalone comments.

Partition key: `/questionId`

Rating values are integers from 1 to 5.

```json
{
  "id": "rating_q_grade10_018_001_34",
  "docType": "rating",
  "questionId": "q_grade10_018_001",
  "gradeId": "grade-10",
  "userId": "34",
  "role": "Teacher",
  "correctness": 5,
  "clarity": 4,
  "difficulty": 3,
  "usefulness": 5,
  "comment": "Clear question, good distractors.",
  "createdAt": "2026-06-20T00:00:00Z",
  "updatedAt": "2026-06-20T00:00:00Z"
}
```

Each question partition also stores one rating summary document:

```json
{
  "id": "rating_summary_q_grade10_018_001",
  "docType": "ratingSummary",
  "questionId": "q_grade10_018_001",
  "gradeId": "grade-10",
  "teacher": {
    "count": 12,
    "correctnessSum": 58,
    "claritySum": 54,
    "difficultySum": 37,
    "usefulnessSum": 56
  },
  "student": {
    "count": 49,
    "correctnessSum": 216,
    "claritySum": 206,
    "difficultySum": 176,
    "usefulnessSum": 221
  },
  "updatedAt": "2026-06-20T00:00:00Z"
}
```

Public responses expose only aggregates by role group:

```json
{
  "teacher": {
    "count": 12,
    "correctness": 4.8,
    "clarity": 4.5,
    "difficulty": 3.1,
    "usefulness": 4.7
  },
  "student": {
    "count": 49,
    "correctness": 4.4,
    "clarity": 4.2,
    "difficulty": 3.6,
    "usefulness": 4.5
  }
}
```

### `Comments`

Purpose: optional user comments attached to ratings or submitted independently.

Partition key: `/gradeId`

Comment visibility rules:

- New comments start as `pending_review`.
- Public and student responses show only `approved` comments.
- Public and student responses must redact names, user IDs, emails, school IDs, phone numbers, and profile details.
- Teacher and Admin moderation views may include limited submitter context needed for review.
- Rejected or archived comments are not shown in public study payloads.
- A comment becomes `approved` after two distinct teachers approve it.
- The comment author cannot approve their own comment.
- If two teachers reject a comment, it becomes `rejected`.
- If teacher reviews conflict, the comment becomes `needs_admin_resolution`.
- Teacher comment moderation queues must support filters for zero teacher approvals and one teacher approval.

Comment document example:

```json
{
  "id": "comment_001",
  "docType": "comment",
  "gradeId": "grade-10",
  "questionId": "q_grade10_018_001",
  "ratingId": "rating_q_grade10_018_001_34",
  "status": "pending_review",
  "visibility": "public_after_review",
  "roleGroup": "teacher",
  "comment": "Clear question, good distractors.",
  "submittedBy": {
    "authProvider": "exam",
    "userId": "34",
    "roleAtSubmission": "Teacher",
    "schoolId": 12
  },
  "reviews": [
    {
      "reviewId": "comment_review_001",
      "teacherUserId": "57",
      "decision": "approve",
      "reviewNote": "Helpful and appropriate.",
      "createdAt": "2026-06-20T00:00:00Z"
    }
  ],
  "teacherApprovalCount": 1,
  "teacherRejectionCount": 0,
  "createdAt": "2026-06-20T00:00:00Z",
  "updatedAt": "2026-06-20T00:00:00Z"
}
```

### `Flags`

Purpose: reports for theological concern, incorrect answer, broken citation, typo, inappropriate content, duplicate, or other issue.

Partition key: `/gradeId`

Flags do not automatically hide a question. They create or maintain a warning badge until resolved by an Admin.

Flagging and flag resolution must write the flag document, affected question warning/archive state, and audit log entry in one `study-content` transactional batch for the `gradeId` partition.

Flag document example:

```json
{
  "id": "flag_001",
  "docType": "flag",
  "gradeId": "grade-10",
  "questionId": "q_grade10_018_001",
  "flagType": "theological_concern",
  "message": "The answer may need review against the official text.",
  "status": "open",
  "submittedBy": {
    "authProvider": "exam",
    "userId": "34",
    "roleAtSubmission": "Teacher",
    "schoolId": 12
  },
  "resolution": null,
  "reviewNote": null,
  "resolvedAt": null,
  "createdAt": "2026-06-20T00:00:00Z"
}
```

### `Suggestions`

Purpose: proposed edits and citations that require peer approval before replacing the visible question version. Suggestion documents live in `study-content`.

Partition key: `/gradeId`

Suggestions store structured JSON patches or typed field changes. Public-safe suggestion summaries may be visible to users so they can see suggested changes, but submitter and approver identity is redacted outside teacher/admin views.

Suggestion workflow:

- Student suggestions are advisory and require teacher action before they can be incorporated.
- Teacher suggestions require approval from any two other distinct teachers globally; the submitter cannot approve their own suggestion.
- Teacher approval is global across schools, grades, and parishes for v1.
- The first reviewing teacher may agree with the submitted change or propose alternate text.
- The second reviewing teacher may agree with the same text or propose alternate text.
- If two reviewing teachers agree on the same proposed text, the suggestion is incorporated automatically, the question version increments, and an audit log entry is written.
- If reviewing teachers disagree or propose incompatible alternate text, the suggestion status becomes `needs_admin_resolution`.
- Admin users can filter `needs_admin_resolution` suggestions, choose the final text, reject the suggestion, or archive it.
- Incorporating a suggestion updates the visible question and does not expose audit details to end users.
- Incorporation must use a Cosmos transactional batch in `study-content` against the same `gradeId` partition.

Suggestion document example:

```json
{
  "id": "sugg_002",
  "docType": "suggestion",
  "gradeId": "grade-10",
  "questionId": "q_grade10_018_001",
  "type": "edit",
  "status": "pending_review",
  "summary": "Fix typo in option B",
  "baseQuestionVersion": 1,
  "patchHash": "sha256:canonical-patch-hash",
  "patch": [
    {
      "op": "replace",
      "path": "/options/1",
      "value": "When the role of money becomes distorted and takes a high priority in your life"
    }
  ],
  "submittedBy": {
    "authProvider": "exam",
    "userId": "34",
    "roleAtSubmission": "Teacher",
    "schoolId": 12
  },
  "reviews": [],
  "approvalCount": 0,
  "rejectionCount": 0,
  "idempotencyKey": "sugg_002:v1",
  "createdAt": "2026-06-20T00:00:00Z",
  "updatedAt": "2026-06-20T00:00:00Z"
}
```

### `AuditLog`

Purpose: immutable record of sensitive operations such as question creation, edits, peer approvals, rejections, admin resolutions, comment moderation, warning resolution, archiving, and cache invalidation. Audit log documents live beside the entity being changed so the state change and audit entry can be committed atomically.

Partition key: `/gradeId`

Audit log document example:

```json
{
  "id": "audit_001",
  "docType": "auditLog",
  "gradeId": "grade-10",
  "entityType": "question",
  "entityId": "q_grade10_018_001",
  "action": "suggestion_incorporated",
  "actorRole": "system",
  "actor": {
    "authProvider": "system",
    "userId": null,
    "roleAtAction": "system"
  },
  "summary": "Suggestion sugg_002 incorporated after two teacher approvals.",
  "details": {
    "suggestionId": "sugg_002",
    "questionVersion": 2
  },
  "createdAt": "2026-06-20T00:00:00Z"
}
```

## 5. Frontend Study Payload Contract

The authoring database uses `questionType`. The API study payload emits the current app-compatible `type` so the static frontend can evolve from the existing JSON shape without changing every study component at once.

Study payload:

```json
{
  "grade": "Grade 10",
  "title": "Interactive Study Companion",
  "description": "Question bank and reference links for Grade 10.",
  "books": [
    {
      "id": "book_pt10",
      "role": "primary",
      "title": "Faith & Tradition: Grade 10"
    }
  ],
  "sections": [
    {
      "id": "faith-in-practice",
      "bookId": "book_pt10",
      "title": "Faith in Practice"
    }
  ],
  "chapters": [
    {
      "id": "18",
      "bookId": "book_pt10",
      "sectionId": "faith-in-practice",
      "title": "Christian Financial Stewardship"
    }
  ],
  "questions": [
    {
      "id": "q_grade10_018_001",
      "chapterId": "18",
      "type": "mcq",
      "difficulty": "medium",
      "status": "unrated",
      "question": "According to the lesson, when does wealth become bad?",
      "options": [
        "When you save money instead of spending it all immediately",
        "When the role of money becomes distorted and takes a high priority in your life",
        "When you earn more than your basic needs require",
        "When you give money to charity"
      ],
      "answer": "When the role of money becomes distorted and takes a high priority in your life",
      "explanation": "The lesson warns against money taking a distorted priority in life.",
      "citations": [
        {
          "id": "cit_001",
          "sourceType": "book",
          "bookId": "book_pt10",
          "chapterId": "18",
          "page": "142",
          "excerpt": "The role of money becomes distorted...",
          "status": "approved"
        }
      ],
      "warning": {
        "active": false,
        "label": null
      },
      "ratings": {
        "teacher": {
          "count": 12,
          "correctness": 4.8,
          "clarity": 4.5,
          "difficulty": 3.1,
          "usefulness": 4.7
        },
        "student": {
          "count": 49,
          "correctness": 4.4,
          "clarity": 4.2,
          "difficulty": 3.6,
          "usefulness": 4.5
        }
      },
      "comments": [
        {
          "id": "comment_001",
          "roleGroup": "teacher",
          "comment": "Clear question, good distractors.",
          "createdAt": "2026-06-20T00:00:00Z"
        }
      ],
      "suggestions": [
        {
          "id": "sugg_002",
          "type": "edit",
          "status": "pending_review",
          "summary": "Suggested wording improvement",
          "createdAt": "2026-06-20T00:00:00Z"
        }
      ]
    }
  ],
  "references": [
    {
      "id": "official-curriculum-reference",
      "title": "Official curriculum reference",
      "href": "https://example.org",
      "description": "Reference description",
      "resourceType": "website",
      "importance": "required",
      "scope": "grade"
    }
  ]
}
```

Default study payload rules:

- Include `unrated` questions with an unrated badge.
- Include `published` questions.
- Include `published` questions with active warnings, with `warning.active: true`.
- Exclude `archived` questions.
- Exclude private identity fields.
- Include only approved public comments.
- Include public-safe pending suggestion summaries, but no submitter identity, approver identity, private review notes, or audit records.
- Public-safe pending suggestion summaries must be server-generated or sanitized allowlist text. Anonymous and student payloads must not echo raw user-submitted suggestion summaries, raw patch values, proposed answer text, or private review notes before incorporation.
- Teacher and Admin suggestion review endpoints may expose raw patches and review notes through authenticated role-shaped serializers.
- Shape anonymous, student, teacher, and admin responses through explicit serializers instead of returning raw Cosmos DB documents.

## 6. External Exam Auth API Contracts

These endpoints are owned by the Exam auth system and are documented here because the Study Companion depends on them. The Study Companion frontend must not call these endpoints directly in v1. Browser code calls Study Companion auth proxy endpoints, and the Study Companion API calls Exam auth server-to-server.

### `POST /auth/login`

Base URL:

```text
https://api-exam.msossa.org/api
```

Auth: none.

Input:

```json
{
  "user_id": "ABC123",
  "password": "user-password",
  "recaptcha_token": "optional-or-required-in-production"
}
```

Success output:

```json
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "user": {
      "id": 34,
      "username": "ABC123",
      "email": "user@example.com",
      "user_type": "school-admin",
      "school_id": 12,
      "email_verified": true
    }
  },
  "message": "Login successful",
  "trace_id": "..."
}
```

Common error output:

```json
{
  "success": false,
  "error": "Invalid user ID or password",
  "trace_id": "..."
}
```

Notes:

- Map `user.user_type` through `mapRole`.
- The Study Companion API proxies this endpoint through its own `POST /auth/login` contract.
- The Study Companion API should convert the Exam token into the selected Study session mechanism; v1 recommends an HttpOnly cookie for browser sessions.
- Whitelist needed user fields before storing app profile state.

### `POST /auth/verify-token`

Auth: optional bearer token or token in body.

Input option 1:

```json
{
  "token": "jwt-token"
}
```

Input option 2:

```http
Authorization: Bearer <token>
```

Success output:

```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "id": 34,
      "username": "ABC123",
      "email": "user@example.com",
      "user_type": "school-admin",
      "school_id": 12,
      "school_name": "School Name",
      "grade": "10",
      "email_verified": true
    }
  },
  "message": "Token verified successfully",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Invalid or expired token",
  "trace_id": "..."
}
```

Notes:

- Use this from the Study Companion API before accepting protected writes.
- The Study Companion API should cache successful validation briefly in Redis by token hash, using the central `study:{env}:...` Redis key helper.
- The Study Companion only stores or forwards the whitelisted auth-context fields needed for authorization: `id`, `username`, `user_type`, `school_id`, `school_name`, `grade`, and `email_verified` if the Exam API returns it.
- If the Exam API does not yet return the full target auth context, keep the Study Companion implementation behind an adapter so the Exam contract can be expanded later without spreading Exam-specific logic through the Study app.

### `GET /auth/profile`

Auth: bearer token.

Input:

```http
Authorization: Bearer <token>
```

Success output:

```json
{
  "success": true,
  "data": {
    "id": 34,
    "username": "ABC123",
    "email": "user@example.com",
    "user_type": "school-admin",
    "school_id": 12,
    "first_name": "First",
    "last_name": "Last",
    "phone": "4045551212",
    "grade": null,
    "status": null,
    "email_verified": true
  },
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Unauthorized",
  "trace_id": "..."
}
```

Notes:

- The Study Companion should whitelist only `id`, `username`, `user_type`, `school_id`, `grade`, and `email_verified` unless a specific feature requires more.
- Public API responses must not expose these fields.

### `POST /auth/logout`

Auth: bearer token.

Input:

```http
Authorization: Bearer <token>
```

Success output:

```json
{
  "success": true,
  "data": null,
  "message": "Logout successful",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Unauthorized",
  "trace_id": "..."
}
```

Notes:

- Study Companion browser sessions clear the encrypted session cookie. JWT-only browser storage is not a v1 mode.
- Logout clears the server session, but the JWT may remain usable until expiry unless the auth system invalidates it.

### `POST /auth/register`

Auth: none.

Input:

```json
{
  "first_name": "Student",
  "last_name": "Name",
  "school_id": 12,
  "grade": "10",
  "email": "student@example.com",
  "password": "StrongPass1!",
  "phone": "4045551212",
  "recaptcha_token": "optional-or-required-in-production"
}
```

Optional input fields:

```json
{
  "age": 15,
  "address_1": "123 Main St",
  "address_2": "Unit 2",
  "city": "Atlanta",
  "state": "GA",
  "zip": "30301",
  "country": "USA"
}
```

Success output:

```json
{
  "success": true,
  "data": {
    "username": "A1B2C3"
  },
  "message": "Registration successful. Please check your email to verify your account.",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Email is required",
  "trace_id": "..."
}
```

Notes:

- Student accounts are created as `student`.
- Student accounts start as pending until approved in the Exam system.
- Study Companion v1 does not expose registration. Student and teacher account creation remains in the Exam app.

### `GET /auth/schools`

Auth: none.

Query input:

```text
q=atlanta
limit=20
offset=0
```

Success output:

```json
{
  "success": true,
  "data": {
    "schools": [
      {
        "id": 12,
        "name": "School Name"
      }
    ],
    "total": 1
  },
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Unable to load schools",
  "trace_id": "..."
}
```

Notes:

- Study Companion v1 does not expose registration, so this endpoint is not needed by the Study frontend unless a later account-management feature is approved.

### `POST /admin/users`

Auth: Exam admin bearer token.

Input:

```json
{
  "email": "teacher@example.com",
  "user_type": "school-admin",
  "school_id": 12,
  "phone": "4045551212",
  "first_name": "Teacher",
  "last_name": "Name"
}
```

Success output:

```json
{
  "success": true,
  "data": {
    "id": 101,
    "user_id": 101,
    "username": "D4E5F6",
    "email": "teacher@example.com",
    "verification_email_sent": true,
    "credentials_email_sent": true,
    "temporary_password": "generated-if-password-not-provided"
  },
  "message": "User created successfully",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Admin access required",
  "trace_id": "..."
}
```

Notes:

- To create a Study Companion Teacher, create a `school-admin` user in the Exam auth system.
- Store/display the user as `Teacher` in the Study Companion, but keep the auth source value as `school-admin`.

## 7. Study Companion API Contracts

The following endpoints are owned by the new Study Companion API. Paths are relative to the Study Companion API base URL, for example:

```text
https://<study-companion-domain>/api
```

### `POST /auth/login`

Purpose: authenticate through Exam auth without exposing the Exam API directly to the browser.

Auth: none.

Input:

```json
{
  "user_id": "ABC123",
  "password": "user-password",
  "recaptcha_token": "optional-or-required-in-production"
}
```

Success output:

```json
{
  "success": true,
  "data": {
    "session": {
      "expiresAt": "2026-06-20T04:00:00Z",
      "csrfToken": "csrf-token-for-write-requests"
    },
    "user": {
      "id": "34",
      "role": "Teacher",
      "sourceRole": "school-admin",
      "schoolId": 12,
      "grade": "10",
      "emailVerified": true
    }
  },
  "message": "Login successful",
  "trace_id": "..."
}
```

Notes:

- The API calls Exam `POST /auth/login` server-to-server and maps the returned `user_type` through `mapRole`.
- For browser sessions, the response sets the Study Companion session cookie containing the encrypted Exam JWT and does not expose the JWT to JavaScript.
- `csrfToken` is JavaScript-readable and must be sent on protected browser write requests, for example in `X-CSRF-Token`.
- The response must not include email, phone, first name, last name, or broad profile details unless a later feature explicitly requires them.

### `GET /auth/me`

Purpose: return the current Study Companion auth context.

Auth: browser session cookie or bearer token.

Success output:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "34",
      "role": "Teacher",
      "sourceRole": "school-admin",
      "schoolId": 12,
      "grade": "10",
      "emailVerified": true
    }
  },
  "trace_id": "..."
}
```

Notes:

- The API decrypts the browser cookie or reads the non-browser/server bearer token, then validates the Exam JWT with Exam `POST /auth/verify-token`, using the short-lived Redis token-hash cache when available.
- This endpoint returns only the whitelisted auth context needed by the Study frontend.

### `POST /auth/logout`

Purpose: clear the Study Companion client session and call Exam logout when useful.

Auth: browser session cookie or bearer token.

Success output:

```json
{
  "success": true,
  "data": null,
  "message": "Logout successful",
  "trace_id": "..."
}
```

Notes:

- Browser clients do not store a JavaScript-readable token. The API clears the Study Companion session cookie; non-browser/server clients discard their bearer token after this call.
- The API may call Exam `POST /auth/logout`, but JWT invalidation remains governed by the Exam auth system.

### `GET /grades`

Purpose: list available grades.

Auth: none.

Input query parameters: none.

Success output:

```json
{
  "success": true,
  "data": {
    "grades": [
      {
        "id": "grade-10",
        "label": "Grade 10",
        "description": "Grade 10 study companion content."
      }
    ]
  },
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Unable to load grades",
  "trace_id": "..."
}
```

Notes:

- This replaces the target need for `public/data/grade-index.json`; the existing static index can remain only as a static fallback while UI-entered Cosmos content is being built out.

### `PUT /admin/grades/{gradeId}/curriculum`

Purpose: create or update grade curriculum metadata through the Admin UI so v1 can be bootstrapped without automated JSON import or direct Cosmos edits.

Auth: browser session cookie or bearer token.

Roles: `Admin`.

Path input:

```text
gradeId=grade-10
```

Input:

```json
{
  "label": "Grade 10",
  "description": "Grade 10 study companion content.",
  "reason": "Initial Grade 10 setup",
  "books": [
    {
      "id": "book_pt10",
      "role": "primary",
      "title": "Faith & Tradition: Grade 10"
    }
  ],
  "sections": [
    {
      "id": "faith-in-practice",
      "bookId": "book_pt10",
      "title": "Faith in Practice"
    }
  ],
  "chapters": [
    {
      "id": "18",
      "bookId": "book_pt10",
      "sectionId": "faith-in-practice",
      "title": "Christian Financial Stewardship"
    }
  ],
  "referenceLinks": [
    {
      "id": "official-curriculum-reference",
      "title": "Official curriculum reference",
      "href": "https://example.org",
      "description": "Reference description",
      "resourceType": "website",
      "importance": "required",
      "scope": "grade"
    }
  ]
}
```

Success output:

```json
{
  "success": true,
  "data": {
    "gradeId": "grade-10",
    "label": "Grade 10",
    "version": 1
  },
  "message": "Curriculum saved",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Admin access required",
  "trace_id": "..."
}
```

Notes:

- `reason` is required for create and update.
- The API validates grade IDs, chapter IDs, URLs, duplicate chapter IDs, and textbook/reference structure before writing.
- The curriculum document and audit log entry must be written in one `study-content` transactional batch for the `gradeId` partition.
- Updating curriculum invalidates the affected grade list, study payload, and teacher/Admin filter caches.

### `GET /grades/{gradeId}/study-payload`

Purpose: return the public-safe or role-shaped grade study payload used by the static frontend.

Auth: optional browser session cookie or bearer token.

Path input:

```text
gradeId=grade-10
```

Success output:

```json
{
  "success": true,
  "data": {
    "grade": "Grade 10",
    "title": "Interactive Study Companion",
    "description": "Question bank and reference links for Grade 10.",
    "chapters": [],
    "questions": [],
    "references": []
  },
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Grade not found",
  "trace_id": "..."
}
```

Notes:

- This endpoint must not expose private user data.
- Anonymous and student responses include visible questions, approved comments, aggregate ratings, warnings, and public-safe suggestion summaries.
- Teacher and Admin responses may include additional moderation fields through explicit serializers.
- Static files under `/data/grades/` are temporary static fallback/manual entry reference only, not the target read path.

### `GET /questions`

Purpose: search or filter authoring questions for teacher and admin workflows.

Auth: browser session cookie or bearer token.

Roles: `Teacher`, `Admin`.

Query input:

```text
gradeId=grade-10
chapterId=18
status=unrated
questionType=mcq
warningActive=true
pendingTeacherApprovalCount=0
q=wealth
limit=25
offset=0
```

Success output:

```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "id": "q_grade10_018_001",
        "gradeId": "grade-10",
        "status": "unrated",
        "questionType": "mcq",
        "chapterId": "18",
        "question": "According to the lesson, when does wealth become bad?",
        "warning": {
          "active": false,
          "reason": null
        },
        "ratingSummary": {
          "teacher": {
            "count": 0
          },
          "student": {
            "count": 0
          }
        },
        "updatedAt": "2026-06-20T00:00:00Z"
      }
    ],
    "total": 1
  },
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Teacher access required",
  "trace_id": "..."
}
```

Notes:

- Teacher results should include enough metadata for content management.
- `pendingTeacherApprovalCount=0` and `pendingTeacherApprovalCount=1` filter to questions with attached comments or suggestions that need first or second teacher approval.
- Do not return full private profile details for authors.

### `POST /questions`

Purpose: create a new teacher-authored question.

Auth: browser session cookie or bearer token.

Roles: `Teacher`, `Admin`.

Input:

```json
{
  "gradeId": "grade-10",
  "questionType": "mcq",
  "chapterId": "18",
  "difficulty": "medium",
  "question": "According to the lesson, when does wealth become bad?",
  "options": [
    "When you save money instead of spending it all immediately",
    "When the role of money becomes distorted and takes a high priority in your life",
    "When you earn more than your basic needs require",
    "When you give money to charity"
  ],
  "answer": "When the role of money becomes distorted and takes a high priority in your life",
  "explanation": "The lesson warns against money taking a distorted priority in life.",
  "citations": [
    {
      "sourceType": "book",
      "bookId": "book_pt10",
      "chapterId": "18",
      "page": "142",
      "excerpt": "The role of money becomes distorted..."
    }
  ]
}
```

Success output:

```json
{
  "success": true,
  "data": {
    "questionId": "q_grade10_018_001",
    "status": "unrated",
    "version": 1
  },
  "message": "Question created as unrated",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "questionType is required",
  "trace_id": "..."
}
```

Notes:

- New teacher questions always start as `unrated`.
- `unrated` questions are visible in the default student app payload with an unrated badge.
- Creating a question writes the question document and audit log entry in one `study-content` transactional batch for the `gradeId` partition.

### `GET /questions/{questionId}`

Purpose: read one authoring question.

Auth: optional.

Roles:

- Anonymous and `Student`: public-safe view only.
- `Teacher`, `Admin`: authoring/review view.

Path input:

```text
questionId=q_grade10_018_001
```

Query input:

```text
gradeId=grade-10
```

Success output for anonymous/student:

```json
{
  "success": true,
  "data": {
    "id": "q_grade10_018_001",
    "gradeId": "grade-10",
    "status": "published",
    "questionType": "mcq",
    "chapterId": "18",
    "question": "According to the lesson, when does wealth become bad?",
    "options": [],
    "answer": "When the role of money becomes distorted and takes a high priority in your life",
    "warning": {
      "active": false,
      "label": null
    },
    "ratings": {
      "teacher": {},
      "student": {}
    }
  },
  "trace_id": "..."
}
```

Success output for teacher/admin:

```json
{
  "success": true,
  "data": {
    "id": "q_grade10_018_001",
    "gradeId": "grade-10",
    "status": "unrated",
    "questionType": "mcq",
    "chapterId": "18",
    "question": "According to the lesson, when does wealth become bad?",
    "options": [],
    "answer": "When the role of money becomes distorted and takes a high priority in your life",
    "citations": [],
    "warning": {
      "active": false,
      "reason": null
    },
    "version": 1,
    "createdAt": "2026-06-20T00:00:00Z",
    "updatedAt": "2026-06-20T00:00:00Z"
  },
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Question not found",
  "trace_id": "..."
}
```

Notes:

- Public-safe output never includes creator identity.

### `PATCH /questions/{questionId}`

Purpose: update question fields directly.

Auth: browser session cookie or bearer token.

Roles: `Admin`.

Input:

```json
{
  "gradeId": "grade-10",
  "reason": "Correct official answer after Admin review",
  "status": "published",
  "difficulty": "medium",
  "question": "According to the lesson, when does wealth become bad?",
  "options": [
    "When you save money instead of spending it all immediately",
    "When the role of money becomes distorted and takes a high priority in your life",
    "When you earn more than your basic needs require",
    "When you give money to charity"
  ],
  "answer": "When the role of money becomes distorted and takes a high priority in your life",
  "explanation": "Updated explanation."
}
```

Success output:

```json
{
  "success": true,
  "data": {
    "questionId": "q_grade10_018_001",
    "version": 2,
    "status": "published"
  },
  "message": "Question updated",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Admin access required",
  "trace_id": "..."
}
```

Notes:

- Normal student/teacher edits should use suggestions rather than this endpoint.
- `reason` is required for Admin direct edits.
- Each accepted change creates a new version and writes the question update and audit log entry in one `study-content` transactional batch.

### `POST /questions/{questionId}/archive`

Purpose: soft-delete a question from normal study payloads.

Auth: browser session cookie or bearer token.

Roles: `Admin`.

Input:

```json
{
  "gradeId": "grade-10",
  "reason": "Duplicate of q_grade10_018_004"
}
```

Success output:

```json
{
  "success": true,
  "data": {
    "questionId": "q_grade10_018_001",
    "status": "archived"
  },
  "message": "Question archived",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Question not found",
  "trace_id": "..."
}
```

Notes:

- Archived questions are retained for audit and rollback.
- `reason` is required for every Admin archive action.
- Archiving writes the question status update and audit log entry in one `study-content` transactional batch.

## 8. Ratings And Comments API Contracts

### `GET /questions/{questionId}/ratings`

Purpose: return public aggregate ratings.

Auth: none.

Path input:

```text
questionId=q_grade10_018_001
```

Query input:

```text
gradeId=grade-10
```

Success output:

```json
{
  "success": true,
  "data": {
    "questionId": "q_grade10_018_001",
    "teacher": {
      "count": 12,
      "correctness": 4.8,
      "clarity": 4.5,
      "difficulty": 3.1,
      "usefulness": 4.7
    },
    "student": {
      "count": 49,
      "correctness": 4.4,
      "clarity": 4.2,
      "difficulty": 3.6,
      "usefulness": 4.5
    }
  },
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Question not found",
  "trace_id": "..."
}
```

Notes:

- Available to anonymous users.
- Never returns individual rater identities.

### `POST /questions/{questionId}/ratings`

Purpose: create or update the authenticated user's rating.

Auth: browser session cookie or bearer token.

Roles: `Student`, `Teacher`, `Admin`.

Input:

```json
{
  "gradeId": "grade-10",
  "correctness": 5,
  "clarity": 4,
  "difficulty": 3,
  "usefulness": 5,
  "comment": "Clear and useful question."
}
```

Success output:

```json
{
  "success": true,
  "data": {
    "questionId": "q_grade10_018_001",
    "ratingId": "rating_q_grade10_018_001_34",
    "roleGroup": "teacher",
    "aggregates": {
      "teacher": {
        "count": 12,
        "correctness": 4.8,
        "clarity": 4.5,
        "difficulty": 3.1,
        "usefulness": 4.7
      },
      "student": {
        "count": 49,
        "correctness": 4.4,
        "clarity": 4.2,
        "difficulty": 3.6,
        "usefulness": 4.5
      }
    }
  },
  "message": "Rating saved",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Ratings must be integers from 1 to 5",
  "trace_id": "..."
}
```

Notes:

- One active rating per user per question.
- Comments are optional. If present, they create or update a `pending_review` comment record for public-after-review moderation.
- The rating document and rating summary document update in one `study-ratings` transactional batch for the `questionId` partition.
- Public aggregates update from the summary document after save.
- If an optional comment is included with a rating, the API writes the rating batch first, then writes the comment moderation record. If the comment write fails, the response must make the partial outcome explicit so the UI can tell the user the rating was saved but the comment was not.

### `GET /questions/{questionId}/comments`

Purpose: return public-safe approved comments or review-selected excerpts.

Auth: none.

Query input:

```text
gradeId=grade-10
limit=20
offset=0
roleGroup=teacher
```

Success output:

```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "comment_001",
        "roleGroup": "teacher",
        "comment": "Clear question, good distractors.",
        "createdAt": "2026-06-20T00:00:00Z"
      }
    ],
    "total": 1
  },
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Question not found",
  "trace_id": "..."
}
```

Notes:

- Do not expose names, user IDs, emails, school IDs, or exact profile details.
- Comments become public only after review.

### `POST /questions/{questionId}/comments`

Purpose: submit an optional comment without changing numeric ratings.

Auth: browser session cookie or bearer token.

Roles: `Student`, `Teacher`, `Admin`.

Input:

```json
{
  "gradeId": "grade-10",
  "comment": "This question helped me review the chapter.",
  "visibility": "public_after_review"
}
```

Success output:

```json
{
  "success": true,
  "data": {
    "commentId": "comment_001",
    "status": "pending_review"
  },
  "message": "Comment submitted",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Comment is required",
  "trace_id": "..."
}
```

Notes:

- Public display happens only after review, and public/student responses never show the comment author's identity.

### `GET /comments/moderation`

Purpose: list comments waiting for teacher approval or Admin resolution.

Auth: browser session cookie or bearer token.

Roles: `Teacher`, `Admin`.

Query input:

```text
gradeId=grade-10
questionId=q_grade10_018_001
status=pending_review
teacherApprovalCount=0
limit=25
offset=0
```

Allowed `teacherApprovalCount` filter values:

- `0`
- `1`

Success output:

```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "comment_001",
        "questionId": "q_grade10_018_001",
        "gradeId": "grade-10",
        "roleGroup": "student",
        "comment": "This question helped me review the chapter.",
        "status": "pending_review",
        "teacherApprovalCount": 0,
        "teacherRejectionCount": 0,
        "createdAt": "2026-06-20T00:00:00Z"
      }
    ],
    "total": 1
  },
  "trace_id": "..."
}
```

Notes:

- Teacher moderation views may include limited submitter context needed to prevent self-approval.
- Public/student responses never expose submitter or approving teacher identity.

### `POST /comments/{commentId}/teacher-review`

Purpose: record a teacher approval or rejection for a public comment.

Auth: browser session cookie or bearer token.

Roles: `Teacher`.

Input:

```json
{
  "gradeId": "grade-10",
  "decision": "approve",
  "reviewNote": "Helpful and appropriate."
}
```

Allowed `decision` values:

- `approve`
- `reject`

Success output:

```json
{
  "success": true,
  "data": {
    "commentId": "comment_001",
    "status": "pending_review",
    "teacherApprovalCount": 1,
    "teacherRejectionCount": 0
  },
  "message": "Comment review saved",
  "trace_id": "..."
}
```

Notes:

- The comment author cannot review their own comment.
- Two distinct teacher approvals change the comment status to `approved`.
- Two distinct teacher rejections change the comment status to `rejected`.
- Mixed teacher decisions move the comment to `needs_admin_resolution`.
- Status changes write comment audit log entries in the same `study-comments` transactional batch, then invalidate affected comment/study payload caches.

### `POST /admin/comments/{commentId}/resolve`

Purpose: let an Admin approve, reject, or archive any pending, disputed, or previously approved public comment workflow.

Auth: browser session cookie or bearer token.

Roles: `Admin`.

Input:

```json
{
  "gradeId": "grade-10",
  "resolution": "approve",
  "reviewNote": "Appropriate for public display."
}
```

Allowed `resolution` values:

- `approve`
- `reject`
- `archive`

Success output:

```json
{
  "success": true,
  "data": {
    "commentId": "comment_001",
    "status": "approved"
  },
  "message": "Comment resolved",
  "trace_id": "..."
}
```

Notes:

- `reviewNote` is required for Admin comment resolution.
- Admins may use this endpoint for ordinary pending comments and for comments already in `needs_admin_resolution`.
- Admin resolution writes the comment update and comment audit log entry in the same `study-comments` transactional batch, then invalidates affected comment/study payload caches.

## 9. Flags And Warning API Contracts

### `POST /questions/{questionId}/flags`

Purpose: report an issue with a question.

Auth: browser session cookie or bearer token.

Roles: `Student`, `Teacher`, `Admin`.

Input:

```json
{
  "gradeId": "grade-10",
  "flagType": "theological_concern",
  "message": "The answer may need review against the official text."
}
```

Allowed `flagType` values:

- `theological_concern`
- `incorrect_answer`
- `broken_citation`
- `typo`
- `duplicate`
- `inappropriate_content`
- `other`

Success output:

```json
{
  "success": true,
  "data": {
    "flagId": "flag_001",
    "questionId": "q_grade10_018_001",
    "warning": {
      "active": true,
      "label": "Under review"
    }
  },
  "message": "Flag submitted",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "flagType is required",
  "trace_id": "..."
}
```

Notes:

- Flagging adds or maintains a warning badge.
- Flagging does not automatically archive or hide a question.
- Flag creation, question warning update, and audit log entry must commit in one `study-content` transactional batch for the `gradeId` partition.

### `GET /admin/flags`

Purpose: list unresolved flags for Admin review.

Auth: browser session cookie or bearer token.

Roles: `Admin`.

Query input:

```text
gradeId=grade-10
flagType=theological_concern
status=open
limit=25
offset=0
```

Success output:

```json
{
  "success": true,
  "data": {
    "flags": [
      {
        "id": "flag_001",
        "questionId": "q_grade10_018_001",
        "gradeId": "grade-10",
        "flagType": "theological_concern",
        "message": "The answer may need review against the official text.",
        "status": "open",
        "createdAt": "2026-06-20T00:00:00Z"
      }
    ],
    "total": 1
  },
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Admin access required",
  "trace_id": "..."
}
```

Notes:

- Admin views may include internal IDs needed for workflow, but not broad profile details.

### `POST /admin/flags/{flagId}/resolve`

Purpose: resolve a flag and optionally update warning/archive state.

Auth: browser session cookie or bearer token.

Roles: `Admin`.

Input:

```json
{
  "gradeId": "grade-10",
  "resolution": "warning_kept",
  "reviewNote": "Needs citation before warning can be removed.",
  "questionWarning": {
    "active": true,
    "label": "Citation under review"
  }
}
```

Allowed `resolution` values:

- `warning_removed`
- `warning_kept`
- `question_archived`
- `no_action_needed`
- `duplicate_flag`

Success output:

```json
{
  "success": true,
  "data": {
    "flagId": "flag_001",
    "status": "resolved",
    "questionId": "q_grade10_018_001",
    "questionStatus": "published",
    "warning": {
      "active": true,
      "label": "Citation under review"
    }
  },
  "message": "Flag resolved",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Invalid resolution",
  "trace_id": "..."
}
```

Notes:

- Resolution writes the flag update, affected question warning/archive update, and audit log entry in one `study-content` transactional batch for the `gradeId` partition.

## 10. Citation And Edit Review API Contracts

### `POST /questions/{questionId}/citations`

Purpose: submit a citation for review.

Auth: browser session cookie or bearer token.

Roles: `Student`, `Teacher`, `Admin`.

Input:

```json
{
  "gradeId": "grade-10",
  "sourceType": "book",
  "bookId": "book_pt10",
  "chapterId": "18",
  "page": "142",
  "excerpt": "The role of money becomes distorted..."
}
```

Allowed `sourceType` values:

- `book`
- `reference`
- `teacher_note`
- `external`
- `other`

Success output:

```json
{
  "success": true,
  "data": {
    "suggestionId": "sugg_001",
    "questionId": "q_grade10_018_001",
    "type": "citation",
    "status": "pending_review"
  },
  "message": "Citation submitted for review",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "sourceType is required",
  "trace_id": "..."
}
```

Notes:

- Citations do not replace visible content until incorporated through the suggestion workflow.

### `POST /questions/{questionId}/suggestions`

Purpose: submit a structured edit suggestion.

Auth: browser session cookie or bearer token.

Roles: `Student`, `Teacher`, `Admin`.

Input:

```json
{
  "gradeId": "grade-10",
  "changeType": "field_patch",
  "summary": "Fix typo in option B",
  "baseQuestionVersion": 1,
  "patch": [
    {
      "op": "replace",
      "path": "/options/1",
      "value": "When the role of money becomes distorted and takes a high priority in your life"
    }
  ]
}
```

Success output:

```json
{
  "success": true,
  "data": {
    "suggestionId": "sugg_002",
    "questionId": "q_grade10_018_001",
    "type": "edit",
    "status": "pending_review"
  },
  "message": "Suggestion submitted for review",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "patch is required",
  "trace_id": "..."
}
```

Notes:

- Suggestions are visible as public-safe summaries but do not change the live question version until incorporated.
- Student suggestions are advisory until two other teachers approve the same proposed change.
- Teacher suggestions require two other distinct teacher approvals; the submitter cannot approve their own suggestion.
- The API must reject patches that do not include the current `baseQuestionVersion`.
- Allowed JSON Patch operations for v1 are `replace` and `add`; `remove`, `move`, `copy`, and `test` are not accepted.
- Allowed patch paths are limited to public authoring fields: `/question`, `/answer`, `/explanation`, `/options/{index}`, `/difficulty`, `/chapterId`, and approved citation insertion paths. Citation insertion may include optional page metadata. Patches must not modify identity fields, audit fields, `status`, `warning`, `version`, timestamps, review arrays, or aggregate counts.
- The API must canonicalize each accepted patch and store a `patchHash` so two teacher approvals can be compared against the exact same proposed change.

### `GET /suggestions`

Purpose: list suggestions for teacher approval queues and Admin dispute resolution.

Auth: browser session cookie or bearer token.

Roles: `Teacher`, `Admin`.

Query input:

```text
gradeId=grade-10
type=edit
status=pending_review
questionId=q_grade10_018_001
approvalCount=0
limit=25
offset=0
```

Success output:

```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "id": "sugg_002",
        "questionId": "q_grade10_018_001",
        "gradeId": "grade-10",
        "type": "edit",
        "summary": "Fix typo in option B",
        "status": "pending_review",
        "approvalCount": 1,
        "needsAdminResolution": false,
        "createdAt": "2026-06-20T00:00:00Z"
      }
    ],
    "total": 1
  },
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Teacher access required",
  "trace_id": "..."
}
```

Notes:

- Public study payloads may include public-safe suggestion summaries. This queue endpoint is for authenticated teacher/admin workflow metadata.
- Detailed review screens should call `GET /suggestions/{suggestionId}` before showing a diff.

### `GET /suggestions/{suggestionId}`

Purpose: fetch the full suggestion, review state, and target question context needed for teacher/Admin review screens.

Auth: browser session cookie or bearer token.

Roles: `Teacher`, `Admin`.

Path input:

```text
suggestionId=sugg_002
```

Query input:

```text
gradeId=grade-10
```

Success output:

```json
{
  "success": true,
  "data": {
    "id": "sugg_002",
    "questionId": "q_grade10_018_001",
    "gradeId": "grade-10",
    "type": "edit",
    "status": "pending_review",
    "summary": "Fix typo in option B",
    "baseQuestionVersion": 1,
    "patchHash": "sha256:canonical-patch-hash",
    "patch": [
      {
        "op": "replace",
        "path": "/options/1",
        "value": "When the role of money becomes distorted and takes a high priority in your life"
      }
    ],
    "submittedContext": {
      "roleAtSubmission": "Teacher",
      "selfSubmitted": false
    },
    "canCurrentUserReview": true,
    "reviews": [
      {
        "reviewId": "suggestion_review_001",
        "decision": "agree",
        "patchHash": "sha256:canonical-patch-hash",
        "reviewNote": "This wording matches the official textbook.",
        "createdAt": "2026-06-20T00:00:00Z"
      }
    ],
    "targetQuestion": {
      "id": "q_grade10_018_001",
      "status": "unrated",
      "questionType": "mcq",
      "chapterId": "18",
      "version": 1,
      "question": "According to the lesson, when does wealth become bad?",
      "options": [
        "When you save money instead of spending it all immediately",
        "When the role of money becomes distorted and takes a high priority in your life",
        "When you earn more than your basic needs require",
        "When you give money to charity"
      ],
      "answer": "When the role of money becomes distorted and takes a high priority in your life",
      "explanation": "The lesson warns against money taking a distorted priority in life."
    }
  },
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Suggestion not found",
  "trace_id": "..."
}
```

Notes:

- This endpoint exposes raw patches and review notes only to authenticated Teacher/Admin workflows.
- `submittedContext.selfSubmitted` and `canCurrentUserReview` let the UI explain self-approval rules without exposing broad submitter profile details.
- The server remains authoritative for self-review, distinct-teacher, patch compatibility, and role checks.

### `POST /suggestions/{suggestionId}/teacher-review`

Purpose: record a teacher's review of a suggestion.

Auth: browser session cookie or bearer token.

Roles: `Teacher`.

Input:

```json
{
  "gradeId": "grade-10",
  "decision": "agree",
  "reviewNote": "This wording matches the official textbook.",
  "alternatePatch": null
}
```

Allowed `decision` values:

- `agree`
- `propose_alternate`
- `disagree`

When `decision` is `propose_alternate`, `alternatePatch` contains the teacher's proposed patch:

```json
{
  "gradeId": "grade-10",
  "decision": "propose_alternate",
  "reviewNote": "Clearer wording.",
  "alternatePatch": [
    {
      "op": "replace",
      "path": "/question",
      "value": "According to the lesson, when does money become spiritually harmful?"
    }
  ]
}
```

Success output:

```json
{
  "success": true,
  "data": {
    "suggestionId": "sugg_002",
    "questionId": "q_grade10_018_001",
    "suggestionStatus": "pending_review",
    "approvalCount": 1,
    "incorporated": false,
    "needsAdminResolution": false
  },
  "message": "Teacher review saved",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Suggestion not found",
  "trace_id": "..."
}
```

Notes:

- The submitter cannot review their own suggestion.
- A teacher can review a suggestion only once unless Admin reopens the workflow.
- If two other distinct teachers agree on the same patch, the API incorporates the suggestion automatically, increments the question version, preserves the question status, writes an audit log entry, and invalidates affected Redis caches.
- Incorporation must commit the question update, suggestion status update, and audit log entry in one Cosmos transactional batch in the `study-content` container for the relevant `gradeId`.
- If teacher reviews disagree or propose incompatible alternate patches, the suggestion becomes `needs_admin_resolution`.

### `POST /admin/suggestions/{suggestionId}/resolve`

Purpose: resolve a disputed or escalated suggestion.

Auth: browser session cookie or bearer token.

Roles: `Admin`.

Input:

```json
{
  "gradeId": "grade-10",
  "resolution": "incorporate_selected_patch",
  "selectedPatchSource": "teacher_review_002",
  "customPatch": null,
  "reviewNote": "Selected the clearer alternate text proposed by the second teacher."
}
```

Allowed `resolution` values:

- `incorporate_selected_patch`
- `incorporate_custom_patch`
- `reject`
- `archive`

When `resolution` is `incorporate_custom_patch`, `customPatch` contains the Admin's final patch.

Success output:

```json
{
  "success": true,
  "data": {
    "suggestionId": "sugg_002",
    "suggestionStatus": "incorporated",
    "questionId": "q_grade10_018_001",
    "questionVersion": 2
  },
  "message": "Suggestion resolved",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Admin access required",
  "trace_id": "..."
}
```

Notes:

- Admin resolution that incorporates a patch must commit the question update, suggestion status update, and audit log entry in one Cosmos transactional batch in the `study-content` container for the relevant `gradeId`.
- Admin resolution that rejects or archives a suggestion must update the suggestion and write the audit log entry in one Cosmos transactional batch.
- End users see only the incorporated question text, not the audit trail or internal teacher disagreement.

## 11. Admin Cache And Audit API Contracts

### `GET /admin/user-contexts`

Purpose: list Admin-visible Study Companion role context for users surfaced by Study workflows.

Auth: browser session cookie or bearer token.

Roles: `Admin`.

Query input:

```text
gradeId=grade-10
role=Teacher
sourceRole=school-admin
schoolId=12
limit=25
offset=0
```

Success output:

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "userctx_grade-10_exam_34",
        "gradeId": "grade-10",
        "role": "Teacher",
        "sourceRole": "school-admin",
        "schoolId": 12,
        "schoolName": "School Name",
        "sourceGrade": "10",
        "lastSeenAt": "2026-06-20T00:00:00Z"
      }
    ],
    "total": 1
  },
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Admin access required",
  "trace_id": "..."
}
```

Notes:

- This endpoint is read-only. It must not create, edit, approve, disable, or delete Exam-owned accounts.
- Responses expose mapped role and source-role context needed for moderation, but not email, phone, password state, first name, last name, or broad profile fields.
- The API reads `docType: "userRoleContext"` documents from `study-content` for the supplied `gradeId`.

### `POST /admin/cache/invalidate`

Purpose: invalidate Redis/API read caches after manual Admin corrections or operational troubleshooting.

Auth: browser session cookie or bearer token.

Roles: `Admin`.

Input:

```json
{
  "gradeId": "grade-10",
  "scope": "study-payload",
  "reason": "Question corrected after Admin resolution"
}
```

Allowed `scope` values:

- `study-payload`
- `question`
- `ratings`
- `comments`
- `suggestions`
- `all-grade`

Success output:

```json
{
  "success": true,
  "data": {
    "gradeId": "grade-10",
    "scope": "study-payload",
    "invalidated": true
  },
  "message": "Cache invalidated",
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Admin access required",
  "trace_id": "..."
}
```

Notes:

- This endpoint does not publish static JSON files.
- Routine content changes should be visible through Cosmos-backed API reads after cache invalidation.
- Automatic writes that incorporate suggestions should invalidate affected cache keys without requiring Admin action.

### `GET /admin/audit`

Purpose: search the Admin-only audit trail.

Auth: browser session cookie or bearer token.

Roles: `Admin`.

Query input:

```text
gradeId=grade-10
entityType=question
entityId=q_grade10_018_001
action=suggestion_incorporated
limit=25
offset=0
```

Success output:

```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": "audit_001",
        "entityType": "question",
        "entityId": "q_grade10_018_001",
        "action": "suggestion_incorporated",
        "actorRole": "system",
        "createdAt": "2026-06-20T00:00:00Z",
        "summary": "Suggestion sugg_002 incorporated after two teacher approvals."
      }
    ],
    "total": 1
  },
  "trace_id": "..."
}
```

Error output:

```json
{
  "success": false,
  "error": "Admin access required",
  "trace_id": "..."
}
```

Notes:

- Audit responses may include internal IDs and limited actor context needed for investigation.
- The endpoint reads grade-scoped audit entries from `study-content` and `study-comments`, merges them by `createdAt` and `id`, and applies filters consistently across both sources.
- Audit responses must not be exposed to anonymous, student, or teacher views.

## 12. CORS And Deployment Notes

The Study Companion frontend calls only the Study Companion API for auth and protected workflows. The recommended v1 deployment serves the API under the same Static Web Apps origin at `/api`, so browser CORS is not needed for Study Companion calls. The Study Companion backend calls the Exam auth API server-to-server, so browser CORS is not involved for the Exam API in v1. If a later implementation uses a separate Functions domain, allow CORS only from the Study Companion production origin.

All dedicated Azure resources required by this repo must be attached to the same dedicated resource group:

```text
rg-sundayschool-studycompanion-central
```

This includes, at minimum:

- Azure Static Web App
- Azure Functions app, only if managed Static Web Apps APIs are not sufficient
- Storage account, only if a separate Functions app requires one
- Application Insights or Log Analytics, if observability is enabled
- Key Vault, if secrets are moved out of app settings

Shared dependencies intentionally remain outside this resource group:

- Existing shared Cosmos DB account, accessed only through new `study-*` containers.
- Existing shared Redis instance, accessed only through `study:{env}:...` keys.

Do not create ad-hoc resources in other resource groups for routine development, publishing, or production support. If an Azure service requires an auxiliary managed resource, document the exception in this plan or in the deployment runbook.

Routine UI and content deployments for this repository should continue to use:

```bash
npm run deploy:azure
```

The deployment helper is:

```text
scripts/deploy-azure-static-webapp.sh
```

## 13. Acceptance Tests

The implementation is ready when these scenarios pass:

- Anonymous users can load the grade list and grade study payload from the Study Companion API.
- Browser login sets a Study Companion HttpOnly, Secure, SameSite cookie containing an encrypted Exam JWT and never exposes the JWT to JavaScript-readable storage or API response data.
- Browser write requests require a valid CSRF token and accepted `Origin` header.
- Non-browser/server clients can authenticate with `Authorization: Bearer <token>` without requiring that browser users use bearer-token storage.
- Anonymous users can see aggregate teacher and student ratings.
- Admin users can create and update grade curriculum metadata, books, optional book sections, chapters, and reference links through the Study Companion UI/API without direct Cosmos edits.
- Grade-partitioned entity reads and writes require explicit `gradeId` input and reject mismatches without leaking cross-grade entity existence.
- Anonymous users can see approved public comments without author identity.
- Anonymous users cannot see personal names, user IDs, emails, school IDs, phone numbers, private comments, audit records, or internal review notes.
- Anonymous and student study payloads do not expose raw pending suggestion patches, raw proposed text, raw user-submitted summaries, submitter identity, approver identity, or private review notes.
- Unrated questions are visible by default with an unrated badge.
- Student ratings accept correctness, clarity, difficulty, usefulness, and optional comments.
- Rating saves update the user's rating and per-question rating summary in one `study-ratings` transactional batch.
- Rating comments and standalone comments enter `pending_review` before public display.
- Public comments become approved only after two distinct teachers approve them.
- Admin users can approve, reject, or archive any pending or disputed public comment with a required review note.
- Comment moderation writes the comment update and comment audit entry in one `study-comments` transactional batch.
- Teacher comment moderation queues can filter comments with zero teacher approvals and one teacher approval.
- Comment moderation queries are grade-scoped against the `study-comments` `/gradeId` partition.
- Mixed teacher comment decisions move comments to `needs_admin_resolution`.
- Teacher and student rating aggregates are stored and displayed separately.
- Teacher-created questions start as `unrated`.
- Flagged questions show warning badges and remain visible unless archived by an Admin.
- Flag creation/resolution writes the flag, affected question warning/archive state, and audit entry in one `study-content` transactional batch.
- Student suggestions remain advisory until teachers approve them.
- Teacher suggestions cannot be approved by their submitter.
- Teacher/Admin suggestion detail screens can load full suggestion patch data and target question context through `GET /suggestions/{suggestionId}`.
- A suggestion is incorporated automatically only after any two other distinct teachers globally agree on the same proposed change.
- Suggestion incorporation commits the question update, suggestion status update, and audit log entry atomically in one `study-content` transactional batch for the same `gradeId`.
- Duplicate suggestion review submissions cannot apply the same patch more than once.
- Teacher disagreement or incompatible alternate text moves a suggestion to `needs_admin_resolution`.
- Admin users can filter and resolve `needs_admin_resolution` suggestions.
- Incorporated suggestions create a new question version and write an audit log entry.
- Admin audit queries are grade-scoped across `study-content` and `study-comments` `/gradeId` partitions.
- End users see incorporated question text but not audit details.
- Archived questions are excluded from normal study payloads.
- V1 content can be entered through the Study Companion UI without relying on automated JSON-to-Cosmos migration tooling.
- Admin users can view role/source-role context needed for moderation without editing Exam-owned user accounts.
- Admin user context responses expose mapped role, source role, school, grade, and last-seen metadata only, with no Exam-owned profile editing.
- Admin direct edits, archives, and moderation resolutions require a reason or review note.
- JWT role mapping handles `admin`, `school-admin`, `school_admin`, `School Admin`, `student`, `Student`, and rejects `evaluator` by default.
- API study payloads produce frontend-compatible `type` fields from authoring `questionType` fields.
