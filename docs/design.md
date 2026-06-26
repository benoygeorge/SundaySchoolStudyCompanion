# Sunday School Study Companion Design Guide

## 1. Purpose

This document defines the UI contract for the target Study Companion app. Implementation work should check this guide before changing screens, layouts, components, copy, or interaction patterns. The platform plan in `docs/plan.md` owns architecture, data, API, auth, and workflow rules; this guide owns user experience consistency.

The app should feel like a focused study and review tool, not a marketing site. It should be calm, readable, fast on phones, and efficient for repeated teacher/admin workflows.

## 2. Design Principles

- Keep study content first. Questions, answers, chapter context, ratings, warnings, comments, and suggestions should be easy to scan without decorative layout.
- Keep identity private by default. Public and student views never show names, user IDs, emails, phone numbers, school IDs, or private review notes.
- Make status visible. `unrated`, warning, pending suggestion, approved comment, and archived states must have consistent badges.
- Prefer dense but readable operational screens for teachers and admins. Avoid large hero sections, marketing cards, or decorative illustrations.
- Keep mobile workflows complete. Students, teachers, and admins should be able to review, rate, comment, approve, and resolve from a phone.
- Use clear empty, loading, error, and success states. Every list and form should explain what happened and what action is available next.

## 3. Information Architecture

Primary areas:

- Study
- Teacher Review
- Admin
- Account

Student and anonymous study:

- Grade selector
- Chapter filter
- Study session
- Question detail
- Ratings summary
- Approved comments
- Public-safe suggestion summaries
- Flag/comment/suggest actions for authenticated users

Teacher review:

- Question management list
- Create question
- Suggest edit or citation
- Suggestion approval queue
- Comment approval queue
- Filters for zero teacher approvals and one teacher approval

Admin:

- Audit log
- User/role visibility
- Comment dispute resolution
- Flag resolution
- Suggestion dispute resolution
- Forced question edit/archive
- Cache invalidation

Account:

- Login
- Current role/source-role display
- Logout

Registration, password management, and broad user profile editing stay in the Exam app.

## 4. Navigation

Use a simple responsive app shell:

- Desktop: left navigation or compact top navigation with clear current section state.
- Mobile: top bar with a menu button and bottom-safe touch targets.
- Keep the current grade visible when the user is inside Study, Teacher Review, or Admin grade-scoped views.
- Do not hide primary actions behind ambiguous icons. Icons may be used with labels for frequent actions.

## 5. Visual System

Use restrained colors with clear semantic meaning:

- Published/stable: neutral or green accent.
- Unrated: amber badge.
- Warning/flagged: red or orange badge.
- Pending review: blue badge.
- Needs Admin resolution: purple or red badge.
- Archived/rejected: muted gray badge.

Typography:

- Use readable body text and compact headings.
- Avoid viewport-scaled font sizes.
- Preserve question text line length on desktop with a constrained reading column.

Layout:

- Avoid nested cards.
- Use cards only for repeated question/comment/suggestion items or focused forms.
- Use full-width page sections and tables/lists for admin/teacher work queues.
- Keep action bars sticky only when they do not hide content on mobile.

## 6. Core Components

Shared components:

- `StatusBadge`
- `QuestionCard`
- `QuestionDetail`
- `RatingSummary`
- `WarningBanner`
- `CommentList`
- `SuggestionSummary`
- `ChapterFilter`
- `GradeSelector`
- `ApprovalQueueTable`
- `AuditLogTable`
- `UserRoleContextTable`
- `ConfirmDialog`
- `ReasonTextarea`

Form controls:

- Use segmented controls for status filters.
- Use checkboxes for chapter multi-select.
- Use select menus for grade, role group, status, and question type.
- Use text areas for comments, suggestions, admin reasons, and review notes.
- Use disabled and loading states on all write buttons.

## 7. Study UI

Question cards should show:

- Chapter and section
- Question type
- Difficulty, when available
- `unrated` badge when applicable
- Warning badge when active
- Rating aggregates
- Approved comments count
- Pending public-safe suggestion count

Question detail should show:

- Question
- Options, if applicable
- Reveal answer action
- Answer and explanation after reveal
- Citation summary
- Approved comments without author identity
- Public-safe suggestion summaries without submitter identity, approver identity, raw patches, or raw proposed answer text before incorporation
- Authenticated actions: rate, comment, flag, suggest edit, submit citation

## 8. Teacher UI

Teacher queues must support:

- Grade filter
- Chapter filter
- Question type filter
- Status filter
- Approval-count filter: zero approvals and one approval
- Search by question text

Suggestion review must show:

- Current question text
- Proposed patch or citation
- Diff between current question content and the proposed patch
- Existing teacher reviews
- Agree action
- Propose alternate action
- Disagree action
- Clear rule that the submitter cannot approve their own suggestion

Comment review must show:

- Comment text
- Question context
- Current approval/rejection counts
- Approve action
- Reject action
- Clear rule that the author cannot approve their own comment

Teacher views may include limited submitter context only when needed to prevent self-approval. They must not expose broad profile details.

## 9. Admin UI

Admin screens should be functional and audit-oriented.

Current grade-scoped admin content management:

- Use an `Admin Menu` selector for major admin areas instead of showing all admin cards at once.
- Curriculum opens on grade metadata and a books list. Sections and chapters stay hidden until the admin selects `Manage` on a specific book.
- Book management is a focus view. While a book is being managed, show only that book, its optional sections, and its chapters until the admin closes or saves.
- Questions open on a book selector. Do not show the question list or editor until the admin selects a book and opens `Manage Questions`.
- Question management is scoped to the selected book. The list, chapter dropdown, and default book citation should not include unrelated books.
- References are managed separately from curriculum structure. References can be grade-, book-, section-, or chapter-scoped, and can also represent external websites, guides, notes, or files without chapter structure.
- Deletes and renames that can affect questions or citations require confirmation.
- Every admin write requires a change reason.

Audit log:

- Filter by grade, entity type, entity ID, action, actor role, and date.
- Show concise summaries first.
- Reveal detail only when needed.

User/role visibility:

- Show mapped Study role, source Exam role, school, and grade where available.
- Do not edit Exam-owned account fields.

Comment resolution:

- Show teacher review history.
- Require a review note for approve, reject, or archive.

Flag resolution:

- Show question context, flag type, message, warning state, and history.
- Require a review note.

Suggestion resolution:

- Show original suggestion, alternate teacher patches, current question, and diff.
- Allow incorporate selected patch, incorporate custom patch, reject, or archive.
- Require a review note.

Forced question edit/archive:

- Require a reason every time.
- Show preview/diff before save.
- Write audit log entries.

Cache invalidation:

- Use scoped controls by grade and cache area.
- Require a reason.
- Confirm before invalidating broad scopes.

## 10. Responsive And Accessibility Requirements

- Minimum touch target: 44px by 44px.
- All interactive controls must be keyboard reachable.
- Forms must have labels, validation messages, and error summaries.
- Badges must not rely on color alone; include text.
- Maintain sufficient contrast for badges, buttons, and warnings.
- Avoid horizontal scrolling on mobile except intentional data tables with clear affordance.
- Long question text, comments, and suggestions must wrap cleanly.

## 11. Copy Rules

- Use direct action labels: `Approve`, `Reject`, `Propose alternate`, `Resolve`, `Archive`, `Save rating`.
- Avoid exposing implementation terms in end-user copy, such as `Cosmos`, `JWT`, or `partition key`.
- Use `Unrated` for new visible questions.
- Use `Under review` for active warnings and flagged content.
- Use `Needs Admin resolution` for conflicted teacher review.

## 12. Implementation Checklist

Before shipping a UI change:

- The screen follows this design guide.
- Public/student views do not expose private identity fields.
- All write actions have loading, success, and error states.
- Mobile layout is usable without hidden core actions.
- Teacher queues include zero-approval and one-approval filters where relevant.
- Admin direct actions require reason or review note.
- Empty states are useful and not dead ends.
