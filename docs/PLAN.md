# Implementation Plan — Chapter Requirements MVP

**Status:** Active plan as of 2026-07-06. This is the working plan; `docs/SPEC.md` is the
long-term product vision and is intentionally NOT the build order. Where they conflict,
this document wins.

## Progress

- **Next task:** Phase 8 COMPLETE (incl. follow-ups 8.13, 8.14). Next: 4.3
  (production launch — urgent for fall rush; import scripts updated for the
  person_sensitive_details split AND the pledge_classes drop), then Phases
  9–15 per the roadmap in assistant memory (`phases-8-15-roadmap.md`).
  **4.3 prep to-do:** export-v3/import-v3 do NOT yet cover positions,
  position_assignments, subgroups, subgroup_members, facilities, rooms — the
  legacy importers that originally loaded those are deleted (8.14), so add
  these tables to the v3 export/import pair before running against production.
  Task 8.14 (script cleanup, user-approved): deleted the eight dead pre-v3
  scripts (backfill-names, backfill-address-emergency, import-airtable-housing,
  import-positions, import-roster, migrate-emergency-contacts,
  migrate-to-affiliation-model, migrate-to-subgroups) — every one referenced
  tables or columns that no longer exist (orgs, org_memberships,
  membership_types, house, person_contacts, pledge_classes, dropped persons
  columns) and could never run again; history stays in git. Remaining scripts:
  export-v3, import-v3, seed-dev, setup-alumni-group.
  Task 8.13 (schema layout cleanup, migration 20260718000005, user-approved):
  one-table decision for member classes — dropped `pledge_classes` (0 rows,
  no readers) + `persons.pledge_class_id` + `subgroups.pledge_class_id`;
  renamed subgroup_type value `pledge_class` → `new_member_class` (neutral;
  0 rows used it); labels go through new `getSubgroupTypeLabel(type,
  terminology)` — epsilon-theta groups' terminology jsonb now maps
  `new_member_class` → "Candidate Class" (Sigma Nu vocabulary as data, not
  schema). `event_categories` is KEPT, reserved for the future events module
  (owner decision). Rush task 10.4 should create `subgroup_type:
  'new_member_class'` subgroups. Legacy scripts (migrate-to-subgroups,
  backfill-names) left as pre-v3 history. Deferred small items: browser walkthrough of the
  claimed-user flows (8.1/8.2 accepts verified at RLS level, not yet in-app),
  a live invite→claim round trip (8.0), first live cron digest run (8.4).
  Known issue: `supabase/schema-reference.sql` is stale (July 6 snapshot;
  regeneration needs Docker Desktop running — `supabase db dump` truncates the
  file and fails without it).
- **Completed:** 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, Phase 5, Phase 6, 7.1, 7.2, 7.3, 7.4, 7.5, 8.0, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12
  Task 8.12 (PII minimization, migration 20260718000004): `date_of_birth`,
  `street_address`/`city`/`state`/`country`, `emergency_contact_person_id` +
  `_relationship` moved from `persons` (visible to every group-mate) to new
  `person_sensitive_details` — RLS: self OR shared-group admin via SECURITY
  DEFINER `can_admin_view_person()`; backfilled, then columns dropped. No
  audit trigger on purpose (would copy PII into the group-readable change
  log). `getPersonProfile` merges the sensitive row (plain members see null
  fields); `updateMyProfile` and `updateMemberDal` route address fields via
  `upsertSensitiveDetails`; `Person` type slimmed; export-v3/import-v3
  scripts handle both old dumps (strip + route) and new dumps (own table) so
  task 4.3 still works. RLS suite extended to 17 tests, all green live.
  Task 8.6: Alumni Chapter group created in dev via idempotent
  `scripts/setup-alumni-group.ts` (group `alumni` / `alumni_chapter` under
  epsilon-theta, Alumni Officer (full) + Alumni Member (limited) role types,
  Fall term definition + active Fall 2026 term, full-access alumni membership
  for officer@test.com). Verified via RLS as the officer persona: both
  chapter and alumni groups visible. URL: /sigma-nu/epsilon-theta/alumni/….
  Task 8.9 (RLS hardening, migration 20260718000003): config-table writes
  (role_types, status_definitions, positions, terms, term_definitions —
  insert/update/delete) recreated at `get_my_admin_group_ids()` level (were
  writable by ANY member); `notifications_insert` now requires the recipient
  to belong to the target group via new SECURITY DEFINER
  `is_person_in_group()` (cross-tenant notification injection closed);
  profile-photos storage select is authenticated-only (bucket itself stays
  public for avatar URLs — full privatization via signed URLs deferred);
  `parent_organizations_update` policy added for platform admins;
  `get_my_organization_ids()` rebuilt for v3 (previously read the dropped
  org_memberships table — Phase 12 housing selects depend on it). Requirements
  CSV export route gains an explicit admin-of-group gate.
  Task 8.8: RLS persona suite — `npm run test:rls` (vitest.config.rls.ts,
  test/rls/isolation.test.ts) logs in as officer/member/outsider @test.com +
  anon against the LIVE dev DB: 15 assertions covering claim-token lockdown,
  outsider isolation, member config-write denial, cross-group notification
  denial, foreign-assignment denial, and admin/org helper positives. All 15
  green. Excluded from `npm run check` (needs the live DB). Extend with each
  new phase's tables.
  Task 8.10: performance indexes (migration 20260718000002) — FK/hot-path
  indexes on group_memberships(group_id), requirement_assignments(person_id),
  requirements(group_id,term_id), position_assignments(group_id,term_id) +
  (person_id), votes(person_id), poll_participants(person_id),
  subgroup_members(person_id) + (subgroup_id), data_change_log(changed_at).
  Applied to dev. (EXPLAIN check skipped: at current row counts the planner
  may seq-scan regardless; these matter as tenants grow.)
  Task 8.0 (CRITICAL security): dropped `claim_tokens_select_by_token
  USING(true)` (migration 20260718000001) — anon REST select on claim_tokens
  verified to return zero rows against the live dev DB. Token lookup for
  /claim/[token] moved server-side (`getClaimTokenInfo`, service role,
  display-safe fields only). `claimRecord` now requires the signed-in email to
  match `claim_tokens.email` (case-insensitive) — closes the account-takeover
  chain. Full invite→claim round-trip re-verification pending next invite test.
  Task 8.11 (app performance): `createClient` + new `getAuthUser` are React
  cache()d (layout + page share one client and one Auth call per navigation —
  all group pages converted); `getGroupContext` is per-request memoized (was
  fetched twice per navigation) and its 7 sequential queries now run in ~4
  rounds via Promise.all; middleware uses `getClaims()` (local JWT verify)
  instead of a network `getUser()` per request; `loading.tsx` added at the
  [group] segment (streaming skeleton); dashboard counts+term parallelized;
  TOKEN_REFRESHED no longer full-refreshes the route every hour;
  `inviteMemberDal` creates one admin client instead of two. Deliberately
  skipped: narrowing `getMembersByOrg`'s `persons(*)` — the edit-member dialog
  is fed from those rows and needs the wide columns. Production build verified.
  Task 8.7: polls and documents finally ring the bell — new notification types
  `poll_published` (to participants on publish), `poll_closed` (results ready),
  `document_in_review` (to active group members on submit-for-review), with
  trigger fns in lib/notifications/triggers.ts and group-prefixed hrefs via 8.3.
  New DAL: `getParticipantPersonIdsDal` (polls), `getActiveMemberPersonIdsDal`
  (members). Actor is always excluded from their own notifications.
  In-app verification deferred: dev DB paused.
  Task 8.5: no more inline Supabase in actions/ (`grep supabase.from( actions/`
  is clean). New DAL fns: `getAssignmentSubmissionContextDal`,
  `getTermStartDatesDal`, `getProgressEntryMetaDal` (dal/requirements.ts),
  `getFullAccessPersonIdsDal` (dal/members.ts — now also filters
  `ended_at IS NULL`, which the old inline officer query didn't). New
  `dal/positions.ts` (`getPositionsForGroupDal`, `getBudgetedPositionsDal`,
  `getActivePositionHoldersDal`) ready for the budgets phase.
  Task 8.4: reminders cron selected nonexistent `persons.email` (digest silently
  never sent) — now `personal_email ?? school_email`; removed dead `'in_progress'`
  from status filters in the cron and calendar-feed routes (real status set is
  pending/submitted/complete/waived). Live cron run deferred: dev DB paused.
  Task 8.3: notification hrefs are now group-prefixed. Pure `buildGroupHref`
  (`lib/utils/hrefs.ts`, unit-tested) + `getGroupSlugPathDal` (dal/orgs.ts);
  trigger functions resolve the full `/[parent]/[org]/[group]/<feature>` link
  internally (call sites still pass '/requirements' as the feature path); cron
  resolves slug paths once per distinct group; digest email links to the app
  root (a digest can span groups). Previously every bell click 404'd.
  Task 8.2: group picker page (`[org]/page.tsx`) now calls `getGroupPickerDataDal`
  (dal/orgs.ts) which resolves the person via `auth_user_id` — the page previously
  queried memberships by the auth uid and showed claimed users zero groups; page
  has no inline Supabase queries left. `getCurrentOrgId` cookie validation joins
  `persons!inner(auth_user_id)` instead of comparing person_id to the auth uid
  (was failing closed for claimed users, breaking all org-scoped actions).
  In-app verification with a claimed persona deferred: dev DB paused.
  Task 8.1: authenticated action helpers now pass `actor: { user, personId }` and
  require a linked persons row (`requirePerson` in action-core); every persons-FK
  call site (created_by, verified_by, logged_by/approved_by, notification
  self-exclusion, notifications/prefs/calendar-token person keys, subgroup
  added_by, poll cast/hasVoted) uses `actor.personId` instead of the auth uid —
  fixes mis-attribution for claim-flow users where persons.id ≠ auth.uid().
  claimRecord moved to createOptionalAuthAction (runs pre-link by design).
  In-app verification with a claimed persona deferred: dev DB paused.
  Phase 7 complete: auth identity decoupled from person identity via `persons.auth_user_id`.
  `get_my_person_id()` SECURITY DEFINER resolves auth.uid() → person.id; all 24 RLS
  policies updated. Claim token system replaces dummy auth user creation on invite.
  `/claim/[token]` page for signup/login + auto-link. My Profile page with inline
  editing (personal fields) and photo upload (Supabase Storage). Change request
  system: members request admin-field changes, admins approve/reject from Settings
  tab; approval auto-applies via service_role.
  Task 4.3 export/import scripts: `scripts/export-v3.ts` dumps all org structure,
  roster, memberships, terms, and auth users to JSON; `scripts/import-v3.ts` reads
  the dump and inserts into a target Supabase project with FK-safe ordering and
  idempotent upserts. Export verified: 404 persons, 404 memberships, full org tree.
  Phase 6 complete: documents table (draft→in_review→approved→archived, kind, versioning,
  file upload fields, poll link), polymorphic comments (threaded, resolvable, anchored,
  with read/write gate functions), comment-requirement links, document-poll approval wiring.
  DAL + actions for both. Document list + detail page with inline comments. Sidebar nav link.
  Phase 5 complete: voting migration, pure calculators (plurality/approval/supermajority/RCV)
  with 16 unit tests, DAL, actions, polls page, ballot + results UI, sidebar nav link.
  Phase 3 complete.
  Phase 2 complete.
  Phase 1 complete.
  Heads-up: the dev DB holds the real roster — see `docs/DEV.md` "Test users &
  real data" before touching auth/email flows.
  Note: task 0.1 also fixed `getAdminSettings` to query by `groups.id`
  (matching v3 cookie) instead of `organizations.id`.
  Task 0.7 added term definition CRUD and term create/activate flow to the admin
  tab. DAL: `upsertTermDefinitionDal`, `deleteTermDefinitionDal`, `createTermDal`,
  `activateTermDal`. Activation marks the previous active term as completed.

Update this block as the final step of every task, inside the task's commit. This
block is the ONLY part of PLAN.md the implementing model may edit; scope, task text,
and decisions change only when the user says so.

---

## 0. How to use this document (instructions for the implementing model)

- Read `docs/DEV.md` first — it documents the environment (hosted dev database, test
  users, schema-change recipe, how to verify in the running app).
- Work **one task at a time**, in order, unless the user says otherwise. Tasks are sized
  to fit in a single session.
- Every task lists a **pattern file** — an existing file that already does the same kind
  of thing correctly. Read it and match its style exactly. Do not invent new patterns.
- After every task: `npm run check` must pass (Biome + tsgo + Vitest). After any schema
  change: `supabase db push`, then `npm run types:db`, then confirm the app still builds.
- **Git protocol:** never start a task on a dirty tree. One commit per task, message
  `task 1.2: <what it did>`, with the Progress ledger update included in that commit.
  Never amend or force-push, never `--no-verify`, never edit an already-pushed
  migration.
- **Stop and ask the user** (do not improvise) when any of these happen:
  - the task seems to need a schema change that §4 doesn't describe;
  - `npm run check` still fails after three fix attempts;
  - the pattern file contradicts this plan or CLAUDE.md;
  - the fix requires touching files clearly outside the task's area;
  - anything tempts you to alter the tenancy model, auth flow, or RLS helpers.
- **Ground truth for the schema is `lib/supabase/types.ts`** (generated). Do not trust
  `supabase/schema-reference.sql` until task 0.3 regenerates it.
- Do not start SPEC.md features that are not in this plan (rush, budgets, meetings,
  house/chores, announcements). They are parked — see §11.
- Do not redesign the tenancy architecture. It has been rewritten three times (v1→v2→v3)
  and is now frozen: `parent_organizations → organizations → groups → group_memberships`.

**Reference repo:** `C:\Users\pires\Projects\Git Clones\business-data-platform` is a
mature production app on the SAME stack (Next.js App Router + Supabase RLS + server
actions — our `actions/utils/` framework matches its `src/actions/utils/`, where it is
used everywhere). Several tasks below say "model on <file>" — read that file first,
then adapt: their `organization_id` ≈ our `group_id`, their `profiles` ≈ our `persons`,
and everything must use our `term_id`/`role_type_id` conventions. Borrow schemas and
pure functions, never whole modules (it has ~150 deps and heavy AWS/committee layers
we don't want).

## 1. Product goal

A volunteer housing-corp leader wants to step back from day-to-day chapter oversight.
The app must let a fraternity chapter run its own semester: officers define what every
brother is **required to do each term**, brothers log in and see their personal
checklist, officers see who is falling behind, and the system nags so a human doesn't
have to.

Real-world shape this must support (and why the schema looks the way it does):
- One **organization** (the chapter entity, e.g. Epsilon Theta) contains multiple
  **groups**: the undergraduate chapter, the housing corporation, possibly an advisory
  board. Each group has its own officers, members, meetings, and business.
- People span groups: an alumnus can be a former chapter member AND a housing-corp
  officer (two `group_memberships` rows). Contacts range from active brothers to
  alumni, prospects, former members, staff, friends/family — modeled as `role_types` +
  `status_definitions` per group, never hardcoded.
- Groups interact: the chapter drafts a budget, the housing corp approves it because it
  pays. (`group_relationships` models "SNHC oversees Chapter". The budget workflow
  itself is post-v1 — §10, Phase 6.)

**V1 is the requirements engine for the chapter group, built group-generic** so the
housing corp can use the identical feature for its own responsibilities with zero
extra work.

## 2. Current state (verified 2026-07-06)

Working end-to-end: login (`/api/auth/login` → cookie session → middleware guard),
group context + permission engine (`lib/context/org-context.tsx`, unit-tested), member
roster/profile/invite/edit, subgroups (view + create), admin tabs (org details, feature
flags, role types, status definitions, positions). Dashboard shows member counts,
current term, officers.

Not built: everything the sidebar links to besides members/subgroups/dashboard/admin —
those links 404. No tables exist for requirements, tasks, events, dues, notifications.

Known debt this plan fixes in Phase 0:
- Hand-rolled server actions ignore the complete action framework in `actions/utils/`.
- `lib/validations/` is stale (references dropped columns) and unused.
- Password reset emails link to a page that doesn't exist; invited users have no way to
  set a password.
- Some tables lack write RLS policies; `supabase/schema-reference.sql` is two
  architecture rewrites out of date.
- The `x-org-id` header / `currentOrgId` cookie plumbing exists but **no RLS policy
  reads it** — security is `auth.uid()` + `get_my_group_ids()` only. That is acceptable
  and is the model going forward; the cookie is app-level UX state, not security.

## 3. Decisions already made (do not relitigate)

| Decision | Choice |
|---|---|
| V1 focus | Chapter requirements engine, group-generic |
| Requirement kinds | `task` (forms/deadlines), `payment` (dues), `attendance` (required events), `quota` (hours: service, study, etc.) |
| Reminders | In-app notifications table + bell; per-person email opt-in delivered via Resend; daily digest via Vercel cron |
| Payments | Tracking only (treasurer records payments). No Stripe/processing in v1 |
| Server actions | The `actions/utils/action-helpers.ts` framework is THE pattern; hand-rolled actions get migrated (task 0.2) |
| Management gate | `access_level === 'full'` manages requirements (same gate the admin page uses). Finer-grained officer perms are future work |
| Audience targeting | `all_active`, `role_types`, `positions`, `subgroups`, `custom`. Position-targeted requirements ("Treasurer: file 990-N") follow the position, not the person — they transfer automatically on officer turnover. Subgroup targeting covers pledge classes / member-development cohorts |
| Architecture | v3 frozen. New feature tables hang off `group_id` and use `term_id` |
| Deployment | Nothing is live. Production Supabase + Vercel go live in Phase 4 with real roster data |
| Audit trail | Generic `log_data_change()` trigger (modeled on reference repo `00058_audit_infrastructure.sql`) attached to requirement tables from day one — "who waived this and when" is a core product question |
| Notifications shape | Per-person rows (audience expanded in code, like assignments), `group_key` for UI collapsing, notification types as TS constants — borrowed from reference repo `00053_notifications.sql`, simplified |
| Voting & doc review | Post-v1 Phases 5–6, ported from the reference repo (§10). Together they later enable the chapter-budget → housing-corp-approval workflow |

## 4. Target data model (new tables)

One migration per phase, named `YYYYMMDD_NNNNNN_description.sql`. RLS on every table,
policy names `table_name_select` / `_insert` / `_update` / `_delete`, membership checks
via `get_my_group_ids()` — never query `group_memberships` directly in a policy.

### `requirements` (Phase 1)
What a group demands of its members for a term.
- `id uuid pk`, `group_id → groups`, `term_id → terms`, `created_by → persons`
- `title text`, `description text null`
- `kind text check in ('task','payment','attendance','quota')`
- `due_at timestamptz null` — deadline for task/payment/quota
- `occurs_at timestamptz null` — event time (attendance only)
- `amount_cents int null` — payment only
- `quota_target numeric null`, `quota_unit text null` — quota only (e.g. 10 / 'hours')
- `requires_verification boolean default false` — task only: member completion needs
  officer sign-off
- `assign_to text check in ('all_active','role_types','positions','subgroups','custom') default 'all_active'`
- `audience_role_type_ids uuid[] null` — when `assign_to = 'role_types'`
- `audience_position_ids uuid[] null` — when `assign_to = 'positions'`: assigned to
  whoever holds the position (via `position_assignments`), so officer-compliance
  deadlines (990-N, insurance renewal, roster submission, national reporting) survive
  officer turnover
- `audience_subgroup_ids uuid[] null` — when `assign_to = 'subgroups'`: targets
  subgroup members (pledge classes, member-development cohorts)
- `is_active boolean default true`, timestamps

### `requirement_assignments` (Phase 1)
One row per person per requirement. Created by the server action when the requirement
is created (expand audience in code — **no triggers**), plus a "sync assignments"
action to pick up members who joined mid-term — and, for position-targeted
requirements, to re-point open assignments when the position holder changes.
- `id uuid pk`, `requirement_id → requirements (cascade)`, `person_id → persons`
- `status text check in ('pending','submitted','complete','waived') default 'pending'`
  — `submitted` only occurs when `requires_verification`; "overdue"/"missed" are
  computed in UI from `due_at`/`occurs_at`, never stored
- `progress numeric default 0` — cents paid (payment) or units logged (quota),
  denormalized from entries
- `completed_at timestamptz null`, `verified_by → persons null`, `note text null`
- unique `(requirement_id, person_id)`

### `requirement_progress_entries` (Phase 2)
Audit trail of partial fulfillment: a dues payment, a logged batch of hours.
- `id uuid pk`, `assignment_id → requirement_assignments (cascade)`
- `amount numeric` (cents or quota units), `occurred_on date`, `note text null`
- `logged_by → persons`, `approved_by → persons null` — quota entries logged by the
  member need officer approval before counting; payments recorded by an officer are
  auto-approved

### `notifications` (Phase 3)
Modeled on reference repo `supabase/migrations/00053_notifications.sql`, simplified:
one row per recipient (chapter scale makes fan-out rows cheaper than their shared-row +
per-user-state design; it also makes RLS trivial — you see your own rows).
- `id uuid pk`, `person_id → persons`, `group_id → groups`
- `type text` (e.g. 'requirement_assigned', 'due_soon', 'submission_to_verify',
  'progress_approved') — types are TS constants in `lib/constants/notifications.ts`,
  not a DB table (their pattern)
- `group_key text null` — collapse related rows in the bell UI (e.g. one entry for
  "3 requirements due this week"); borrow their key format `<type>:<entity_id>`
- `title text`, `body text null`, `href text null` — href is the in-app link
- `read_at timestamptz null`, `emailed_at timestamptz null`, `created_at`
- Role-targeted sends ("notify all officers / all pledges") are a `lib` helper that
  expands `role_type_ids → person rows` in code, same approach as requirement audience
  expansion — no triggers. Mirror their trigger organization: one small typed function
  per notification type (see reference `src/lib/services/notifications/triggers/`).

### `notification_preferences` (Phase 3)
- `person_id uuid pk → persons`, `email_enabled boolean default false`,
  `email_digest boolean default true`
- If per-type/per-channel granularity is ever needed, evolve to their composite-PK
  `(person_id, type)` per-channel model from `00053` — don't invent a new shape

### `data_change_log` (Phase 1)
Generic audit table + `log_data_change()` SECURITY DEFINER trigger function capturing
old/new row JSONB with actor and timestamp on UPDATE/DELETE. Model on reference repo
`00058_audit_infrastructure.sql` (drop their org-resolution introspection; store
`group_id` explicitly where available). Attach via `CREATE TRIGGER` to `requirements`,
`requirement_assignments`, and (Phase 2) `requirement_progress_entries`. Read-only to
full-access members of the group; no UI in v1 — it exists to answer disputes.

RLS sketch (all four tables): members SELECT rows for groups in `get_my_group_ids()`
(assignments/notifications: own rows always; officers of the group see all). Writes:
requirement CRUD and verification require a full-access membership in that group —
add a `SECURITY DEFINER` helper `get_my_admin_group_ids()` (groups where my active
role_type has `access_level = 'full'`) in the Phase 1 migration and use it in write
policies. Members may INSERT their own progress entries and UPDATE their own
task-assignment status pending→submitted/complete.

## 5. Phase 0 — Ground truth & one pattern (do first)

- **0.1 Migrate hand-rolled actions to the framework.** Rewrite
  `actions/members/invite-member.action.ts`, `actions/members/update-member.action.ts`,
  `actions/subgroups/manage-subgroup.action.ts`, `actions/admin/update-settings.action.ts`
  to use `createOrgAuthenticatedAction` / `createValidatedOrgAction` from
  `actions/utils/action-helpers.ts`, moving their inline Supabase calls into `dal/`
  functions. Rewrite `lib/validations/` schemas to match current columns
  (`role_type_id`, `status_id` — NOT `membership_type_id`) and wire them in. Pattern:
  the helper JSDoc in `actions/utils/action-helpers.ts` + existing DAL style in
  `dal/members.ts`. Accept: all four action files use helpers, no direct Supabase in
  actions, invite/edit/create flows still work, `npm run check` green.
- **0.2 Delete dead code.** Remove `app/(app)/dashboard/page.tsx` (orphan stub),
  `actions/auth/login.action.ts` and `actions/auth/resolve-redirect.ts` (login uses the
  API route), and unused helpers in `lib/utils/positions.ts` / `lib/utils/terms.ts` if
  still unreferenced after 0.1. Accept: `npm run check` green, login still works.
- **0.3 Regenerate schema reference.** Replace `supabase/schema-reference.sql` with a
  dump of the real schema (`supabase db dump --schema public`), keeping the header
  comment explaining it's a reference, not a migration. Accept: file matches
  `lib/supabase/types.ts` table names.
- **0.4 Finish the password loop.** Add `app/(auth)/update-password/page.tsx` (+ the
  code-exchange callback route Supabase redirects to) so both password-reset emails and
  newly invited members can set a password. Point `resetPasswordForEmail` and the
  invite flow at it. Middleware already whitelists `/reset-password`; add the new
  route. Pattern: `app/(auth)/reset-password/page.tsx`. Accept: full reset round-trip
  works locally (use Supabase local inbucket to read the email).
- **0.5 RLS audit.** Verify every public table has RLS enabled; add the missing write
  policies noted in review (`groups` delete, `group_relationships` update/delete,
  `organization_admins` update) restricted to org admins / platform admins. One
  migration. Accept: `supabase db push` clean; a non-admin test user cannot mutate
  those tables.
- **0.6 Sidebar honesty.** In `components/layout/app-sidebar.tsx`, render only links
  with real pages (dashboard, members, subgroups, admin — and requirements once Phase 1
  lands). Keep the feature-flag mechanism; just stop rendering flagged features that
  have no route. Accept: no sidebar link 404s.
- **0.7 Term management.** The term-definitions admin tab is a "coming soon" stub, but
  Phase 1 (requirements), 1.5 (clone-from-term), and the dashboard all assume a current
  term exists — today creating one means writing SQL. Build create/edit term (name,
  start/end dates) and a "start next term" flow in the admin tab, via a DAL + validated
  org action like the rest of admin. Pattern: the role-types tab in
  `components/admin/admin-panel.tsx` + post-0.1
  `actions/admin/update-settings.action.ts`. Accept: an
  officer can create the Fall term entirely in the UI and the dashboard shows it as
  current.
- **0.8 (optional) Subgroup member management UI.** Wire the existing
  `addSubgroupMember`/`removeSubgroupMember` actions into
  `app/(app)/[parent]/[org]/[group]/subgroups/[slug]/page.tsx`. Pattern:
  `components/members/invite-member-dialog.tsx`. Accept: can add/remove members from a
  subgroup in the UI.
- **0.9 Rewrite the dev seed script for v3.** `scripts/seed-dev.ts` predates the v3
  schema — it writes to dropped tables (`fraternities`, `orgs`, `membership_types`,
  `org_memberships`) and fails. Rewrite it idempotently (upserts) against the current
  schema. The live dev DB already contains the real org, groups, and roster
  (`docs/DEV.md`), so the script must be additive and idempotent: upsert only the
  three `@test.com` verification personas from DEV.md (full-access officer, plain
  member, outsider with no chapter membership) into the existing
  sigma-nu/epsilon-theta org, creating a current term only if none exists. It must
  never duplicate the org/groups or modify roster rows. Run with
  `npx tsx --env-file=.env.local scripts/seed-dev.ts`. Pattern: the old script's
  upsert structure + `lib/supabase/types.ts` for column truth. Accept: runs clean
  twice in a row against the live dev DB; all three personas can log in and see
  exactly what DEV.md says they should; roster row counts unchanged.

## 6. Phase 1 — Requirements engine core

- **1.1 Migration + types.** Create `requirements`, `requirement_assignments`, the
  `get_my_admin_group_ids()` helper, RLS per §4, plus `data_change_log` +
  `log_data_change()` attached to both tables (§4). Then `supabase db push` +
  `npm run types:db`. Pattern: `supabase/migrations/20260405000001_architecture_v3_groups.sql`
  (for style), base statuses migration (for seeding style), reference repo
  `00058_audit_infrastructure.sql` (for the audit trigger). Accept: types file contains
  the tables; updating a requirement writes a `data_change_log` row.
- **1.2 DAL + actions.** `dal/requirements.ts`: `getRequirementsForGroup` (with
  per-requirement completion counts), `getMyAssignments(termId)`,
  `getRequirementDetail` (assignment rows + person names). Actions in
  `actions/requirements/manage-requirement.action.ts`: `createRequirement` (expands
  audience into assignments in code), `updateRequirement`, `archiveRequirement`,
  `syncRequirementAssignments`. Zod schemas in `lib/validations/requirement.ts`.
  Pattern: post-0.1 `actions/admin/update-settings.action.ts`. Accept: unit test for
  the audience-expansion function (pure logic in `lib/utils/requirements.ts`) covering
  all five `assign_to` modes — position expansion resolves current holders via
  `position_assignments`, subgroup expansion via `subgroup_members`.
- **1.3 Requirements page.** `app/(app)/[parent]/[org]/[group]/requirements/page.tsx`:
  members see "My requirements" for the current term grouped by status with due dates
  and progress bars; full-access users also see a manage table (all requirements,
  completion ratio) with a create/edit dialog (fields switch on `kind`). Add sidebar
  link. Pattern: `members/page.tsx` + `members-table.tsx` + `edit-member-dialog.tsx`.
  Accept: officer creates one requirement of each kind; a member sees exactly the ones
  targeting their role.
- **1.4 Dashboard card.** "My requirements: N of M complete, next due X" linking to the
  page. Pattern: existing stat cards in `[group]/dashboard/page.tsx`. Accept: card
  reflects a mixed pending/complete state correctly.
- **1.5 Clone from previous term.** `cloneRequirementsFromTerm` action + button in the
  manage view: copies a term's requirements (not assignments, not progress) into the
  current term, shifting `due_at`/`occurs_at` by the delta between term start dates,
  then expands assignments as in 1.2. This is the v1 answer to "officers shouldn't
  re-type Fall's requirements every Spring" — if it ever feels limiting, the upgrade
  path is the template→definition→instance pattern in reference repo `00051_tasks.sql`.
  Accept: cloning Fall→Spring produces active requirements with shifted dates and
  fresh pending assignments.

## 7. Phase 2 — Fulfillment flows

- **2.1 Requirement detail page (officer).**
  `requirements/[id]/page.tsx`: table of every assignee with status/progress; actions
  per row — mark complete, waive (with note), verify submitted tasks. Bulk attendance
  check-in for `attendance` kind (checkbox list → one action call). Accept: officer
  can run attendance for a meeting in under a minute.
- **2.2 Member self-service.** On the requirements page: mark a `task` done (→
  `complete`, or `submitted` when `requires_verification`); log hours against a
  `quota` (creates an unapproved progress entry). Accept: statuses transition
  correctly; member cannot touch other people's assignments (verify RLS blocks it, not
  just UI).
- **2.3 Progress entries + approval.** Migration for `requirement_progress_entries`
  (§4) with `progress` recomputed in the DAL mutation (sum of approved entries;
  auto-complete payment/quota assignments when target reached). Treasurer records
  payments from the detail page; officer approves/rejects hour logs (approval queue on
  the detail page). Accept: partial dues payments accumulate; unapproved hours don't
  count; hitting the target flips status to `complete`.
- **2.4 Term completion export.** CSV export from the manage view: one file per term
  with requirement × member completion (status, dates, progress, attendance,
  approved hours). This is what feeds national annual reporting / awards submissions
  (e.g. Sigma Nu Pursuit of Excellence) and university/IFC service-and-standing
  reports — but keep it group-generic: it's just "export this term's completion
  evidence". Plain route handler streaming CSV built in `lib/`; no new tables. Accept:
  export of a mixed term opens in Excel and matches the detail pages.

## 8. Phase 3 — Notifications & email

- **3.1 Notifications core.** Migration for `notifications` +
  `notification_preferences` (§4). Type constants + one small typed trigger function
  per notification type in `lib/` (model on reference repo
  `src/lib/services/notifications/triggers/`), called from the server actions that
  cause them: assigned, submission-to-verify (role-targeted to full-access members),
  progress-approved. Bell in the sidebar with unread count, dropdown grouped by
  `group_key`, mark-read. Accept: creating a requirement notifies every assignee
  in-app; three same-type notifications collapse to one bell entry.
- **3.2 Due-soon reminders + email.** `app/api/cron/reminders/route.ts` guarded by
  `CRON_SECRET`, scheduled daily via `vercel.json`; creates `due_soon` notifications
  (due within 3 days, or missed) and sends one digest email per opted-in person via
  Resend (set `emailed_at`; never double-send). Email preference toggle on the member's
  own profile/edit dialog. Pattern for threshold logic: reference repo's
  `document-expiration` cron. Accept: cron run is idempotent (running twice sends
  nothing the second time); email renders with links back to the app.
- **3.3 ICS calendar feed.** Per-person iCalendar feed of requirement due dates and
  attendance events so obligations land in the phone calendar members already check.
  Route like `app/api/calendar/[token]/route.ts` — calendar clients can't
  authenticate, so use a per-person random feed token (column on
  `notification_preferences`, regenerable) and query with the service-role client
  scoped by that token. Generate the `.ics` in `lib/` (pure string building, unit
  test the escaping — no heavy dependency). Surface the subscribe URL next to the
  email toggle. Accept: subscribing in Google Calendar / Apple Calendar shows the
  term's due dates; regenerating the token kills the old URL.

## 9. Phase 4 — Production deployment

- **4.1 Production Supabase.** Create the production project, link, `supabase db push`
  all migrations, apply auth settings (site URL, redirect URLs for the Phase-0.4
  password routes, SMTP or default mailer). Accept: fresh project has full schema +
  Sigma Nu seed.
- **4.2 Vercel.** Deploy; set env vars (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SENTRY_DSN` + auth
  token, `RESEND_API_KEY`, `CRON_SECRET`). Review `next.config.ts` CSP (already
  allows `*.supabase.co`) and remove/parameterize the hardcoded `allowedDevOrigins`
  LAN IP. Confirm Vercel cron fires. Accept: login on the production URL works;
  Sentry receives a test event.
- **4.3 Real data + pilot.** Run the `scripts/` importers against production (roster,
  positions, housing), create the Fall term, invite 2–3 officers first, then the
  chapter. Accept: an officer creates the semester's real requirements; a brother logs
  in on their phone and sees their checklist.

## 10. Phases 5–6 — post-v1, ported from the reference repo

Start these only after Phase 4 ships. Both are user-approved borrows from
`business-data-platform`; each task's first step is reading the referenced files.
Together they unlock the end-state workflow the user cares about personally: the
chapter drafts a budget document, housing-corp members comment on it, then formally
vote to approve it.

### Phase 5 — Voting (motions, elections, secret ballots)

Port the reference voting system, minus its committee/funding layers.
- **Schema** (model on `supabase/migrations/00047_voting.sql`): `polls` (`group_id`,
  `term_id null`, two-axis state: `lifecycle` draft/published/archived × `status`
  open/closed + `opens_at`/`closes_at`, `voting_method`, `method_settings jsonb`,
  `vote_privacy`), `poll_options` (immutable after creation), `poll_participants`
  (with `invitation_token` — lets community members on the housing corp vote without
  full accounts), `votes` (**immutable**: `vote_data jsonb` ballot, no UPDATE/DELETE
  policies, unique per person per poll; keep their `enforce_vote_profile_id` trigger).
  Skip: anonymous/fingerprint voting, rubric criteria, committees. Chapter secret
  ballots = their `private` privacy level (attribution stored, only officers see who
  voted; results shown in aggregate).
- **Governance mechanics the reference schema lacks** (chapter meetings run on
  Robert's Rules — model these from the start, don't retrofit):
  - **Quorum**: `quorum` field on `polls` (min voters or fraction of eligible
    participants; the reference repo kept this in its committee layer, which we skip).
    A poll that closes without quorum reports "no quorum", not a result.
  - **Abstentions**: first-class abstain option on every ballot — counts toward
    quorum but NOT toward the threshold denominator (this changes 2/3-vote outcomes;
    the calculators in `lib/utils/voting/` must take it as an explicit input).
  - **Proxy voting**: `votes.cast_by_person_id null` distinct from the ballot's
    `person_id`, allowed only when the poll enables proxies — housing-corp and
    alumni meetings use proxies routinely even though undergrad chapters rarely do.
- **Counting**: never tally in the DB. Port the pure calculators from
  `src/lib/engines/voting/methods/{rcv,plurality,approval,supermajority}.ts` +
  `calculator.ts` into `lib/utils/voting/` with their unit tests adapted. This is the
  single highest-value copy in the whole repo.
- **UI**: poll list + create dialog (method-specific settings), ballot page per
  method, results view (reference `src/components/tools/voting/`, esp.
  `voting-interface.tsx`; simplify aggressively).
- Accept: an RCV officer election and a 2/3-supermajority motion both run end-to-end;
  a closed poll rejects new ballots at the RLS layer, not just the UI.

### Phase 6 — Documents, review & commenting (minutes, bylaws, budgets)

- **Comments first — they're the reusable core.** One polymorphic `comments` table
  (model on `00055_comments.sql`): `resource_type` + `resource_id` (no FK; access
  validated by two SECURITY DEFINER functions — read gate and write gate),
  `parent_comment_id` threads, `resolved_at`/`resolved_by` (CHECK both-or-neither),
  `visibility`, and text anchoring via `anchor_text` + `anchor_context_before/after` +
  `anchor_metadata jsonb` (context snippets re-attach when text shifts — do not use
  bare offsets). Adding a commentable surface later = one `WHEN` case per gate
  function.
- **Documents v1 = simple**: `documents` table (group_id, term_id null, title, kind:
  minutes/bylaws/budget/other, `status` draft→in_review→approved→archived with
  stamped `submitted_at`/`approved_at`/`approved_by`, `version` + `parent_document_id`
  for new-version-clones) + file upload to **Supabase Storage** (NOT their S3/Lambda
  pipeline) and/or a plain rich-text body. Explicitly skip TipTap collaborative
  editing and the Hocuspocus/Yjs server — comments and lifecycle don't depend on them
  (their own code proves it: comments work on non-editor surfaces).
- **Comment → requirement link** (their `comment_task_links` + auto-resolve triggers,
  ours pointing at `requirement_assignments`): a blocking review comment can spawn a
  requirement task; completing it posts a system reply and resolves the comment.
- **The payoff wiring**: `polls.document_id uuid null` — a first-class "vote to
  approve this document" link the reference repo lacks (it routes through its funding
  layer instead). A housing-corp poll on a chapter budget document, gated on the
  document being `in_review`, closes the loop.
- Accept: chapter uploads draft minutes → members comment inline → author resolves →
  officer moves to approved; a budget document gets a linked supermajority poll whose
  passage flips it to approved.

## 11. Parked (explicitly out of scope until the user reopens them)

Housing-corp meetings module (Phase 6 documents cover minutes review; scheduling/
agendas are not built) · budgets as structured data (Phase 6 treats a budget as a
document; line-items/expenses per SPEC.md Part 8 are parked) · announcements · full
events calendar (attendance requirements stand alone for now) · full SPEC.md
elections module (nominations, eligibility rules — Phase 5 polls cover the votes
themselves) · rush · house/rooms/chores UI · dues invoicing/payment processing ·
white-label onboarding, subdomains, billing · QuickBooks. All specced in
`docs/SPEC.md`; none block v1.

**Parked — activities / interaction log.** A unified activity log tracking
member interactions, officer notes, advisor check-ins, and housing-corp
communications. Modeled on the `activities` system in `business-data-platform`
(migration `00054_activities.sql`): polymorphic domain routing via `context`
JSONB, participant tracking, follow-up dates, cross-entity linking via
`activity_subjects`. Relevant when the housing corp or advisory board needs
to track interactions with the chapter, or for officer-handoff continuity.
Reference tables: `activities`, `activity_participants`, `activity_subjects`,
`activity_access`.

**Parked Phase 7 — national starter template pack.** Once Phases 1–2 prove out,
seed `national_org_templates` with a Sigma Nu pack: LEAD-phase requirement sets
targeted at pledge-class subgroups, the standard officer compliance calendar as
position-targeted requirements (990-N, insurance, roster/IFC filings, national
reporting), standard position slugs (Commander, Lt. Commander, Recorder, Treasurer),
and terminology defaults (Sigma Nu says *candidate*, never *pledge* — respect the
`terminology` jsonb in all seeded copy). Makes onboarding a new chapter one click.
Keep the mechanism national-org-generic; only the seed data is Sigma Nu-specific.

## 12. Conventions & guardrails (recap for every task)

- Layers: `actions/` (helpers from `actions/utils/action-helpers.ts`, return
  `ActionResult<T>`) → `lib/` (pure logic) → `dal/` (only place that touches Supabase,
  first param `supabase: DbClient`). Pages call actions/DAL, never Supabase directly.
- IDs: always `term_id`, `role_type_id`, `status_id`, `group_id`. The words
  "semester", "membership_type", and hardcoded role names must not appear in new code.
- Keep every feature group-generic: no behavior keyed on `group_type === 'chapter'`.
- New UI: shadcn components from `components/ui/`, permission-gate with
  `useOrg()`/`getGroupContext` like `members/page.tsx` does.
- Finish line for every task: `npm run check` green AND the task's accept criterion
  exercised in the running app (see `docs/DEV.md` — a green typecheck is not "done");
  schema tasks also need `supabase db push` + `npm run types:db` + updated
  `supabase/schema-reference.sql`. Then commit (one commit per task, ledger included)
  and update the Progress block at the top of this file.

### Do NOT store (liability guardrails — apply to every feature, present and future)

- **Judicial/honor-board detail.** A status change ("suspended") with a neutral note
  is fine; allegations, hearing records, and deliberations stay off-platform —
  conduct records in a database are discoverable in litigation.
- **Grades.** Store the determination ("met scholarship standard: yes/no, verified
  by X"), never GPAs or transcripts. Study hours are already a quota requirement.
- **Event risk detail.** When events are eventually built: compliance is a checklist
  ("pre-event form completed: yes"); guest lists and alcohol-related records are not
  retained.
- **Payment processing.** Track whether the obligation is satisfied; the money moves
  on the chapter's billing platform. Don't drift toward invoicing/processing.
- **Ritual content.** Nothing from any fraternity's ritual, ever, anywhere in the
  app — including seed data, test fixtures, and example copy.

---

## 13. Phase 8 — Hardening (user-approved 2026-07-17)

Fixes from a full code review + multi-tenant isolation audit + performance audit.
Full task details (schemas, file refs, accept criteria) live in the session plan
mirrored to the assistant memory file `phases-8-15-roadmap.md`; Phases 9–15 (officer
permissions, rush, budgets, housing lottery, service requests, housing extras, term
rollover) are planned there and are NOT yet part of this document's build order.

- **8.0 Claim-token security fix (CRITICAL — first).** Drop the
  `claim_tokens_select_by_token USING(true)` policy; look tokens up server-side via
  service role on `/claim/[token]`; `claimRecord` must require the caller's email to
  match `claim_tokens.email`. Accept: anon REST select on `claim_tokens` returns
  zero rows; mismatched-email claim rejected; legit claim round-trip works.
- **8.1 personId through action helpers.** Authenticated helpers pass
  `actor: { user, personId }`; all persons-FK call sites (`created_by`,
  `verified_by`, `logged_by`, notification filters, notification/prefs keys) use
  `actor.personId`. Claim flow moves to `createOptionalAuthAction`. Accept: claimed
  test user's writes attribute to their `persons.id`.
- **8.2 Group picker fix.** `[org]/page.tsx` resolves person via `auth_user_id`
  through a new `dal/orgs.ts` function; no raw Supabase in the page. Also fix
  `getCurrentOrgId` (`lib/auth/org-context.ts`) comparing `person_id` to auth uid.
- **8.3 Group-prefixed notification hrefs.** `getGroupSlugPathDal` + pure
  `buildGroupHref` (unit-tested); triggers + cron build full
  `/[parent]/[org]/[group]/…` links.
- **8.4 Cron/calendar fixes.** Digest uses
  `COALESCE(personal_email, school_email)`; remove dead `'in_progress'` status
  filters.
- **8.5 DAL cleanup + `dal/positions.ts`.** No inline Supabase in actions; new
  positions DAL consolidating scattered queries.
- **8.6 Alumni chapter group (data).** New `groups` row + role types/statuses/
  positions/term for the alumni chapter.
- **8.7 Poll/document notification triggers.** `POLL_PUBLISHED`, `POLL_CLOSED`,
  `DOCUMENT_IN_REVIEW` types + trigger fns called from the corresponding actions.
- **8.8 RLS persona tests.** `npm run test:rls` Vitest suite (officer/member/
  outsider personas against the dev DB; not part of `npm run check`).
- **8.9 RLS hardening migration.** Config-table writes to admin level;
  `notifications_insert` binds person→group via SECURITY DEFINER helper;
  profile-photos select authenticated-only; `parent_organizations` write policy;
  recreate broken `get_my_organization_ids()`.
- **8.10 Index migration.** `group_memberships(group_id)`,
  `requirement_assignments(person_id)`, `requirements(group_id, term_id)`,
  `position_assignments(group_id, term_id)` + `(person_id)`, `votes(person_id)`,
  `poll_participants(person_id)`, `subgroup_members` FKs,
  `data_change_log(changed_at)`.
- **8.11 App performance pass.** React `cache()` for `getGroupContext`/`getUser`;
  parallelize context + dashboard queries; middleware local JWT check;
  `loading.tsx` streaming; narrow roster selects; drop TOKEN_REFRESHED full
  refresh; reuse admin client in `inviteMemberDal`.
- **8.12 Person PII minimization.** Move DOB/address/emergency-contact columns to
  `person_sensitive_details` (RLS: self + shared-group admins); update profile/
  roster DALs + UI.
