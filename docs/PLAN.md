# Implementation Plan — Chapter Requirements MVP

**Status:** Active plan as of 2026-07-06. This is the working plan; `docs/SPEC.md` is the
long-term product vision and is intentionally NOT the build order. Where they conflict,
this document wins.

## Progress

- **Phases 9 + 10 COMPLETE (2026-07-20), reviewed before commit.** Task 9.2:
  `ctx.moduleRoles` + `canManageModule` (client `canManage`, server
  `canManageFromContext`) — module gates reach the UI. Tasks 10.2–10.5:
  recruitment module live (prospect pipeline board, events tab + check-in,
  feedback, secret bid votes via the polls engine incl. per-group/national
  threshold config + legacy override (migration 20260720000001:
  parent_organizations.settings, prospects.is_legacy), one-click conversion →
  member + candidate-class subgroup + claim invite), dashboard redesigned
  (attention feed, requirements ring, member segments), export/import scripts
  extended for 4.3. An 8-angle code review (all findings verified) caught and
  fixed pre-commit: a privilege escalation (convertProspect had no
  recruitment gate over its service-role writes), single bid votes created
  unpublished/un-votable, non-atomic conversion with swallowed errors +
  duplicate-person/duplicate-membership risks, dashboard regressions (role
  badge + officers list restored), 4 inline-Supabase page queries + missing
  info text, an ~180-query batch bid-vote path, and a double-click double-poll
  race. Deliberate: legacy threshold falls back to standard when unconfigured;
  literal revalidatePaths kept (pre-existing app-wide convention +
  router.refresh). In-app walkthrough of the full rush cycle still pending
  (accepts exercised at RLS/test level).
- **Login flow + platform-admin controls (user-directed 2026-07-19):** root
  `/` is now the post-login lander — single org goes straight in (dashboard
  or group picker), multiple orgs render an organization picker
  (`getMyOrganizationsDal`); membership-less platform admins land on
  /platform-admin. Platform admins get a sidebar control strip
  (`AdminSwitcher`): jump to any organization, any group, and a **view-as**
  selector (yourself / officer / member). Mechanics: migration
  20260719000007 adds `is_platform_admin()` + additive select policies on
  organizations/groups (verified live: admin persona sees all 3 groups,
  member still sees 1; RLS suite 24 green); `getGroupContext` synthesizes a
  virtual role — "Platform Admin" (full) for groups the admin doesn't belong
  to, or an officer/member preview role from the `viewAs` cookie (context
  memo keys on it). View-as is a UI/permission PREVIEW — RLS still governs
  all data underneath. Note: cross-org page DATA may render empty until
  feature-table policies grow admin branches; layout/nav is the goal here.
- **Sidebar layout preview (user-directed 2026-07-19):** navigation now shows
  the full module layout ahead of feature wiring, honoring the no-404 rule via
  `ModulePreview` placeholder pages (each states its phase and what will live
  there). New group-flag-gated entries: Events, Recruitment (label from group
  terminology — chapter shows "Rush"), Housing, Issues top-level; new Money
  section (Budget, Reimbursements) gated on the `budget` flag. `OrgFeatures`
  gains `recruitment`/`issues` keys (legacy `rush` marked deprecated). Dev
  flags set: chapter all modules ("Rush" terminology), SNHC +issues, alumni
  +events/budget. Note: `useOrg().org` is the GROUP (legacy naming) — module
  flags read from group features. When a phase's real page lands, it replaces
  the preview in place.
- **Schema-first batch (user-directed 2026-07-19):** the schema+RLS portions
  of Phases 9–13 are DONE ahead of feature code, implementing the layout-pass
  decisions (full rationale in §14).
  Migrations 20260719000001–06: module permission helpers
  (`get_my_module_admin_group_ids` activating is_rush_chair/is_treasurer/
  is_house_manager, `get_my_position_ids`); generic `events` (kind +
  event_categories link) + `prospects`/`event_prospect_attendance`/
  `prospect_feedback` (neutral recruitment naming; feedback has NO audit
  trigger by design); `budgets`/`budget_proposals`/`budget_line_items`
  (multi-budget per term, cross-group `approver_group_id`, general proposal)
  + `reimbursements` (officer-area routing, credit-via-payments-engine,
  `receipts` bucket); housing re-scope (facilities.managed_by_group_id,
  org-wide reads, house-manager writes, audit triggers);
  `housing_point_adjustments` + `housing_lotteries`/`_entrants`/`_picks`
  (DB-enforced turns via `current_lottery_turn` + SECURITY DEFINER triggers
  bridging picks → room_assignments); generalized `issues` (kind,
  reported_by, assigned_to, escalation) + `issue-photos` bucket; comments
  CHECK + `can_read_comments` extended with 'budget' (two-group) and 'issue'
  (two-group). RLS persona suite extended to 24 tests, all green live.
  Feature code (DAL/actions/UI) still lands with its phases.
- **Next task:** Phase 8 COMPLETE (incl. follow-ups 8.13, 8.14). Next: 4.3
  (production launch — urgent for fall rush; import scripts updated for the
  person_sensitive_details split AND the pledge_classes drop), then Phases
  9–15 per §14.
  **4.3 prep DONE (2026-07-19):** export-v3/import-v3 now cover all 21 tables
  including system_position_roles, positions, facilities, rooms, subgroups,
  position_assignments, subgroup_members. Verified: export pulls correct row
  counts, idempotent re-import succeeds with 0 errors.
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
- **4.4 File storage → direct AWS S3 (user decision 2026-07-21).** The app stores
  files in Supabase Storage today (member avatars → `profile-photos`, receipts,
  issue photos, prospect photos → `prospect-photos`). Production target is a direct
  AWS S3 bucket. Two paths: (a) point Supabase Storage's backend at the S3 bucket
  (infra config, zero app code — keeps the one storage API); or (b) integrate the
  AWS SDK with presigned PUT (upload) / GET (display) URLs. Each file store keeps an
  opaque path/key column, so path (b) is localized per feature — e.g. prospect
  photos: only `components/recruitment/prospect-photo-upload.tsx` + the resolvers in
  `dal/prospect-photos.ts` change (column/action/UI stay). Prereqs for (b): bucket
  name + region + `AWS_*` credentials as env vars, and `@aws-sdk/client-s3` +
  presigner deps. Decide (a) vs (b) at deploy; (a) is simpler and app-wide.

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
themselves) · rush · house/rooms UI · chores (direction decided — see the
chores note below) · dues invoicing/payment processing ·
white-label onboarding, subdomains, billing · QuickBooks. All specced in
`docs/SPEC.md`; none block v1.

**Parked — chores (direction decided 2026-07-20; build later).** Chores are
NOT a new subsystem and NOT part of `issues`. A chore is an obligation pushed
DOWN onto residents — assigned, due-dated, checked off, optionally
house-manager-verified — i.e. exactly a `requirements` row with `kind='task'`.
So chores live in the requirements engine, reusing its completion tracking,
verification, notifications, due-soon cron, and ICS feed (SPEC's parked
`chores`/`chore_assignments` pair is duplicate completion-tracking — do not
build it). Supporting pieces already approved: the assignment pool is the
`house_residents` subgroup (auto-synced from `room_assignments` via
`membership_type='automatic'`), and missing a chore closes the loop through a
negative `housing_point_adjustments` entry (worse next room-draw position).
**The one genuinely missing capability is recurrence + rotation** — and it is
NOT chore-specific (weekly meeting attendance, weekly study hours, monthly
inspections want the same thing), so build it into the requirements engine:
a recurring template that stamps out task instances on a cadence, with an
assignment strategy of "everyone in the audience" or "rotate through the
audience". That generator likely needs ONE small definition/rotation-config
table — which comes back to the user for explicit approval (columns + RLS) per
the no-new-tables rule when chores are unparked; instances themselves are
requirement assignments, not new rows. Caveat to handle then: house-duty
volume (residents × weeks × chores) lands in the same table that feeds the
national-reporting CSV — separate "house duties" from "national requirements"
by filtering on the recurring template, not a schema split.

**Meeting / committee action items (direction decided 2026-07-20; belongs to
the parked meetings module).** Scenario: a social chair asks a committee member
to do something before the next meeting. This is a `requirements` row with
`kind='task'` assigned to that one person (via `assign_to='custom'` /
`custom_person_ids`, or `assign_to='subgroups'` targeting the committee — a
committee IS a subgroup), due by the next meeting. It matches the task profile
on every axis (pushed down, assigned→done, creator ≠ owner); N=1 is a
legitimate use of the engine, not an abuse. **This is the same
source→requirement composition as `comment → requirement` (shipped) and
`issue → requirement` (planned): the requirements engine is the universal
"someone owes something, tracked to done" substrate, and meetings/issues/
comments/chores are SOURCES that feed it. That is the SPEC "unified task
engine" — realized as composition, not a mega-table.** Long-term home is the
meetings module (action items are born from minutes: owner + due date), where
each action item is a task requirement linked to the meeting that spawned it.
- **Two gaps this exposes (both fixable WITHOUT a new table; discuss before
  building):** (1) *Creation rights* — creating a requirement needs full admin
  today, but a committee head shouldn't. Anchor: `subgroups.head_position_id`
  already names the committee head — let a subgroup head assign requirements
  within their own committee (an RLS/permission extension, generalizes to any
  head). (2) *Coordination vs. compliance* — an informal action item must NOT
  land in the Pursuit-of-Excellence export next to "pay dues," and probably
  wants its own lane in "My Requirements." That is a category flag/column on
  `requirements` (a column, not a table) that touches the reporting export, so
  it needs explicit sign-off. Same distinction the chores note raises.

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
Phases 9–15 (officer permissions, recruitment, budgets, housing lottery, issues,
housing extras, term rollover) are §14 of this document — canonical as of
2026-07-19.

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

---

## 14. Phases 9–15 — approved feature roadmap (ported 2026-07-19; canonical here)

Planned 2026-07-17/19 with the user through a full schema layout pass — every
table below was individually challenged for necessity, redundancy, and naming
before approval. **The schema+RLS portions of Phases 9–13 are ALREADY LIVE**
(migrations 20260719000001–07, applied to dev; RLS persona suite green).
Implementers: do NOT create those tables again — write only the
DAL/actions/lib/UI portions against the live schema (ground truth:
`lib/supabase/types.ts`), and extend `npm run test:rls` with every new
surface. HARD RULE (user, 2026-07-19): no NEW tables or storage buckets beyond
the ones specified here without explicit user discussion and approval first.
⚠ The Phase 14.2 signing tables (`document_packages`,
`document_signatures`) are specified below but NOT yet created and NOT yet
user-reviewed — they require that discussion before migrating.

**User decisions locked in (Q&A):**
- Rush: prospect roster + bid pipeline, rush events with per-prospect check-in,
  brother feedback; **on bid acceptance feedback is wiped and the prospect converts
  to the roster** (auto-create person + candidate membership + claim invite; also
  auto-add to a candidate-class subgroup). Bid decisions = secret ballot via the
  existing polls engine. No public interest form.
- Budgets: each `has_budget` position holder submits a line-item proposal; compiled
  into one group budget; approval = designated-approver pass then *optionally* a
  formal vote — configurable per budget (`approver` / `vote` / `approver_then_vote`).
- Lottery points: composite — app activity + seniority + manual adjustments (with
  reasons). Seniority = time since `group_memberships.started_at`. Computed **fresh
  per lottery** with a configurable lookback; no career ledger.
- Lottery flow: live draft in points order; skip rule configurable — skipped brothers
  may pick any time after their slot; optional per-turn timer (X hours) auto-skips.
- Service requests: chapter house manager triages; escalation to SNHC via the seeded
  `group_relationships` "SNHC oversees Chapter".
- Alumni chapter: create as a third group in Phase 8 (data-only; `groups.group_type`
  is unconstrained text).
- Fold-ins (all approved): poll/document notification triggers + automated RLS
  persona tests (Phase 8); position-based module permissions (Phase 9); term
  rollover wizard (Phase 15); housing extras = **both** room swaps/moves UI and
  housing contracts (Phase 14).

### Phase 9 — Position-based module permissions

Today every management surface gates on `access_level === 'full'`; the rush chair,
treasurer, and house manager would each need full admin. The schema already carries
`system_position_roles.is_rush_chair / is_treasurer / is_house_manager` — unused.
Minimal design: module rights = full-access role **OR** active holder of a position
whose system role has the module flag. Existing features stay admin-gated (unchanged).

**9.1 Migration `module_permissions.sql`.**
One SECURITY DEFINER helper (pattern: `get_my_admin_group_ids` in `20260708000001`):
```sql
get_my_module_admin_group_ids(p_module text) RETURNS SETOF uuid
-- groups from get_my_admin_group_ids()
-- UNION groups where I hold an active position_assignment (term_end IS NULL)
--   whose positions.system_role_id → system_position_roles has the flag
--   matching p_module ('rush'|'treasurer'|'house_manager')
```
Later phases' write policies call it with their module name.
*Accept:* SQL role-play — persona holding a rush-chair position (non-admin role) is
returned for `'rush'`, not `'treasurer'`.

**9.2 App-layer surface.**
Extend `lib/utils/permissions.ts` (unit-tested — extend, don't reimplement) +
`getGroupContext`/`useOrg` to expose `moduleRoles: { rush, treasurer, houseManager }`
resolved from active position assignments; a `canManage(module)` helper =
`access_level === 'full' || moduleRoles[module]`. UI in later phases gates on it.
*Accept:* unit tests for flag resolution; rush-chair persona sees (future) manage UI
without full admin — verified concretely in Phase 10.

---

### Phase 10 — Recruitment ("rush": prospects, events, feedback, bid votes, conversion)

Adapts SPEC Part 14 to v3. Group-generic; sidebar gated by the `recruitment`
feature flag (pattern: Members/Subgroups gating in
`components/layout/app-sidebar.tsx`), display name via group terminology
("Rush" for Sigma Nu, "Recruitment" for NPC, "Intake" for NPHC).

**NAMING DECISION (user-approved 2026-07-18): tradition-neutral identifiers.**
Tables are `prospects`, `prospect_feedback`, `events`,
`event_prospect_attendance`; the pipeline column is `status` (not bid_status);
the feature flag is `recruitment`; route is `/recruitment`. "Rush"/"bid" appear
only in per-group terminology and UI copy. Exception: the module-permission key
stays `'rush'` because it maps to the existing
`system_position_roles.is_rush_chair` column.

**DESIGN DECISION (user-approved 2026-07-18): `events` is GENERIC, not
rush-scoped.** One events table for the whole platform — recruitment is its
first consumer; the future events/calendar module and meetings reuse it.
Durable calendar facts (title/time/place) persist; everything
prospect-sensitive hangs off `prospects` and cascades away on purge.
Prospect attendance and (future) member attendance are sibling tables on the
same event — different subjects, different retention — never one polymorphic
table.

**Why prospects are NOT persons-with-a-status (challenged and settled
2026-07-18):** persons are permanent platform identities; prospects are
purgeable pipeline records (~100 PNMs/term, most never join — PII retention
liability). Persons-based prospects would also be invisible under
`persons_select` RLS (no shared membership) or would contaminate every
member-facing feature with "…except prospects" filters. Acceptance is the
promotion ritual into persons.

**Privacy stance (drives the schema):** feedback lives only in recruitment
context, is **hard-deleted on bid acceptance** and purgeable per term.
`prospect_feedback` therefore gets **NO `log_data_change()` audit trigger** —
an audit copy would defeat the purge. Prospect/pipeline tables do get audit
triggers. Consistent with PLAN.md §12.

**10.1 Migration `recruitment.sql`** (pattern: `20260706000002` RLS/audit style,
`20260707000004` poll-link):
- `events` (GENERIC): `group_id`, `term_id null`, `title`, `description`,
  `starts_at`, `ends_at null`, `location null`,
  `kind` (`'recruitment'` now; `'meeting'`/`'social'`/`'service'` when the events
  module lands), `category_id → event_categories null` (the kept table finally
  gets its consumer), `created_by`, timestamps.
- `prospects`: `group_id`, `term_id`, `full_name`, `email null`, `phone null`,
  `school_year null`, `status` (`prospect/offered/accepted/declined/withdrawn`),
  `poll_id → polls null` (mirrors `documents.poll_id`), `converted_person_id null`,
  `added_by`, timestamps; unique `(group_id, term_id, lower(email))` where not null.
- `event_prospect_attendance`: `event_id (cascade)`, `prospect_id (cascade)`,
  `checked_in_by`, `created_at`; unique `(event_id, prospect_id)`. Cascades away
  with the prospect — the purge story stays airtight.
- `prospect_feedback`: `prospect_id (cascade)`, `author_person_id`, `body`,
  `rating int null CHECK 1..5`, `created_at`. Flat, append-only; NOT the polymorphic
  comments table (purge isolation); **no audit trigger**.
- RLS: selects = group members. Prospect/event writes =
  `get_my_module_admin_group_ids('rush')`; attendance insert also open to members
  (any member checks a prospect in); feedback insert own
  (`author_person_id = get_my_person_id()`), delete own or recruitment-admin; no
  update.
- Audit triggers on prospects/events/attendance only.
*Accept:* member can add feedback + check in but not change prospect `status`;
rush-chair persona (non-admin) can; feedback delete leaves no trace in
`data_change_log`.

**10.2 DAL + validations.** `dal/recruitment.ts`: `getProspectsForTermDal`
(attendance + feedback counts), `getProspectDetailDal`, prospect CRUD,
`checkInProspectDal`, `addFeedbackDal`, `deleteFeedbackDal`,
`purgeProspectFeedbackDal`, `linkPollToProspectDal`, `setProspectStatusDal`;
`dal/events.ts` (generic): event CRUD scoped by kind. Zod in
`lib/validations/recruitment.ts`.

**10.3 Bid votes via polls engine.**
`createBidVote` (rush-manage gate): one poll per prospect — `vote_privacy: 'private'`,
supermajority default (`method_settings` threshold), `allow_abstain`, participants =
active members — via `createPollDal`, then `linkPollToProspectDal`. Batch "open votes
for all undecided" for bid night. On close (mirror document-poll close in
`actions/polls.action.ts`): calculator `passed` → prospect `status='offered'`;
failed stays `prospect` (terminal status is a human call).
*Accept:* 3-prospect bid night: secret ballots, closing marks passed ones `offered`;
individual ballots invisible to members.

**10.4 Bid acceptance → conversion + wipe + candidate class.**
`convertProspect` (rush-manage gate; prospect must be `offered`): compose Phase 7
machinery — create/match person by email, create `group_memberships` with
dialog-chosen candidate `role_type_id`/`status_id` (never hardcoded), issue claim
token + invite (pattern: `actions/members/invite-member.action.ts` post-8.5), **add
to a candidate-class subgroup** (pick-or-create in the dialog, `subgroup_type:
'new_member_class'` — the type value was renamed from pledge_class in task 8.13,
and the label comes from `getSubgroupTypeLabel(type, terminology)` — epsilon-theta
groups render "Candidate Class") so requirement targeting works day
one. Same action: `purgeProspectFeedbackDal`, prospect `status='accepted'`,
`converted_person_id`. Prospect row survives as pipeline record. Also
`purgeTermRecruitmentData` (end-of-term feedback wipe for all the term's
prospects).
*Accept:* converting creates a claimable candidate membership (claim link works in
incognito), member appears in the candidate-class subgroup, feedback rows gone;
declined prospects keep feedback until term purge.

**10.5 Recruitment UI.**
`/[parent]/[org]/[group]/recruitment`: pipeline board/table by `status` (attendance +
feedback counts, add/edit dialog); prospect detail (info, attendance, feedback
stream + add box, bid-vote status, convert button); events tab with roster-style
check-in checkboxes (pattern: attendance UI from task 2.1 in
`components/requirements/`). Manage controls gated `canManage('rush')`.
*Accept (phase exit):* full cycle in the running app — add prospects, phone check-in,
feedback, secret bid vote, convert, candidate claims account; converted member's
profile shows no rush artifacts; a rush-chair persona without full admin ran it all.

---

### Phase 11 — Budgets (group-generic structured data)

**DESIGN DECISIONS (layout pass with user, 2026-07-18):**
- **Budgets are NOT documents.** Challenged and settled: `documents` (kind
  'budget') stays for uploaded narratives/spreadsheets ONLY; the structured
  workflow (proposals, line items, computed totals, ratification) lives in
  these tables. Don't branch documents RLS on kind.
- **Multiple budgets per group per term.** Real world: each semester has at
  least an operating/officer-expenses budget AND a house bill. Uniqueness is
  `(group_id, term_id, title)` — title is load-bearing ("Operating Budget",
  "Officer Expenses", "House Bill").
- **Cross-group approval.** The approving body can be a DIFFERENT group (SNHC
  approves the house bill AND the rush/recruitment budget; exec approves
  officer expenses). New
  `approver_group_id null → groups` (null = own group). Mirrors the
  facility_issues two-group pattern: select RLS = owning OR approver group;
  approve/ratify actions gate on the APPROVER group's treasurer/admins; a
  vote-mode ratification poll is created IN the approver group (their members
  ballot). UI suggests the approver from `group_relationships`.
- **General proposal.** A budget may have no per-position proposals (SNHC
  house bill): proposals CHECK is AT MOST one of position_id/subgroup_id —
  both null = the budget's general proposal, owned by `submitted_by`.
- **`category` stays plain text** — no lookup table until a second consumer
  needs shared categories (the event_categories lesson in reverse).
- **Poll-link direction rule:** domain tables point AT polls
  (`budgets.poll_id`, `prospects.poll_id`); never add more per-feature FK
  columns onto `polls` (polls.document_id is historical, not a pattern).
- Names already tradition-neutral; the permission key `'treasurer'` maps to
  the existing `system_position_roles.is_treasurer` column.

**11.1 Migration `budgets.sql`** (pattern: `20260707000004` lifecycle+poll-link+
comment-gate; `20260706000002` RLS/audit):
- `budgets`: `group_id`, `term_id`, `title`, `status`
  (`drafting→in_review→approved→ratified`, + `archived`), `approval_mode`
  (`approver`/`vote`/`approver_then_vote`), `approver_group_id null → groups`
  (null = own group; SNHC for the house bill), `approver_position_id null`
  (null = any approver-group admin), `submitted_at/approved_at/approved_by`,
  `poll_id`, `ratified_at`, `created_by`, timestamps,
  `UNIQUE (group_id, term_id, title)`.
- `budget_proposals`: `budget_id`, `position_id null`, `subgroup_id null` (CHECK
  AT MOST one set — both null = general proposal; UNIQUE per budget on each),
  `submitted_by`, `status` (`draft`/`submitted`/`returned`), `submitted_at`,
  `notes`.
- `budget_line_items`: `proposal_id`, `description`, `amount NUMERIC(10,2) ≥ 0`,
  `category`, `notes`, `display_order`. No stored totals — computed in lib.
- Helper `get_my_position_ids()` (SECURITY DEFINER, active holders). RLS: selects
  = owning group OR approver group; budget management writes
  `get_my_module_admin_group_ids('treasurer')` on the owning group;
  approve/ratify on the approver group (own group when approver_group_id is
  null); proposal/line-item writes treasurer-or-holder, gated on lifecycle
  (`budgets.status='drafting'` / proposal `status='draft'` for holders).
- Audit triggers all three; add `'budget'` to comments CHECK +
  `can_read_comments` (read gate grants BOTH owning and approver groups).
*Accept:* RLS blocks a holder editing someone else's proposal; own draft succeeds;
treasurer persona (non-admin) can compile; an SNHC admin can see + approve a
chapter house-bill budget whose approver_group_id is SNHC, and a plain chapter
member cannot approve it.

**11.2 Pure lib + validations.** `lib/utils/budgets.ts`: `rollupBudget` (per-proposal/
per-category/grand totals), `nextBudgetStatus` state machine for all three approval
modes — unit-tested matrix (pattern: `lib/utils/voting/calculator.test.ts`). Zod in
`lib/validations/budget.ts`.

**11.3 DAL + actions.** `dal/budgets.ts` (pattern `dal/documents.ts` incl.
`linkPollToDocumentDal` wiring): get/create, proposal upsert/submit/return, line-item
CRUD, `compileBudgetDal` (→ `in_review`; amalgamation computed, no snapshot),
`approveBudgetDal`, `linkPollToBudgetDal`, `ratifyBudgetDal`.
`actions/budgets.action.ts` (validated org helpers + `personId`). `createBudgetPoll`
creates a supermajority poll IN the approver group (participants = that group's
active members — SNHC ballots on the house bill, the chapter on its own
operating budget) + links via `budgets.poll_id`; budget-linked poll close runs
`supermajority` → ratify on `passed`. Notifications:
`BUDGET_PROPOSAL_SUBMITTED` (treasurer/admins), `BUDGET_RETURNED` (holder),
`BUDGET_RATIFIED` (group).
*Accept:* full happy path drafting→in_review→approved→poll→ratified via actions;
returned proposal editable again.

**11.4 Budget UI.** `/[parent]/[org]/[group]/budget`: proposal cards with totals +
status chips; "My proposal" line-item editor for holders; manage controls
(`canManage('treasurer')`): compile, return, approve, create ratification poll;
linked-poll result; comments thread (`resource_type: 'budget'`, reuse documents
comment components). Sidebar link. Patterns: `components/requirements/`,
`components/documents/`, `components/polls/`.
*Accept (phase exit):* two holders submit; treasurer compiles + approves; linked
supermajority poll passes; budget Ratified, proposals read-only; comment round-trips.

**11.5 Reimbursements (UNPARKED — user-approved 2026-07-18).**
Real-world flow: a non-officer brother buys food/tickets for an event, submits
a reimbursement with receipts + which officer's budget it belongs to; that
officer approves; the treasurer then pays it out OR applies it as a credit
against the brother's other obligations (eventually synced to QuickBooks).

- Migration `reimbursements.sql`: `reimbursements` — `group_id`, `term_id null`,
  `submitted_by → persons`, `amount NUMERIC(10,2) > 0`, `description`,
  `occurred_on date`, `receipt_paths text[]` (new `receipts` storage bucket,
  authenticated-only, policies cloned from profile-photos but private),
  `proposal_id null → budget_proposals` (the officer's budget area — submitter
  picks the area, app resolves the responsible officer = current holder of the
  proposal's position), `line_item_id null → budget_line_items` (pinned by the
  officer at approval — enables spent-vs-budgeted per line, computed never
  stored), `status`
  (`submitted → approved → reimbursed | credited`, `rejected` at either stage),
  `approved_by/approved_at` (officer), `resolved_by/resolved_at/resolution_note`
  (treasurer), `applied_progress_entry_id null → requirement_progress_entries`
  (set when credited), `external_ref text null` (future QuickBooks txn/credit
  memo id — `persons.quickbooks_customer_id`/`vendor_id` already exist as the
  account link), timestamps. **Audit trigger YES** — financial dispute records
  are exactly what data_change_log is for (opposite call from prospect_feedback).
- RLS: insert = any group member with `submitted_by = get_my_person_id()`;
  select = own rows OR treasurer-gate OR holder of the linked proposal's
  position; approve = proposal position holder or treasurer; resolve =
  `get_my_module_admin_group_ids('treasurer')`.
- **Credit application reuses the payments engine:** "apply as credit" creates
  a `requirement_progress_entry` on a chosen payment assignment (e.g. dues),
  note links back to the reimbursement, and the existing
  `recomputeAssignmentProgress` auto-completes the obligation when covered. No
  separate ledger/balance table — an approved-but-unresolved reimbursement IS
  the outstanding credit, visible in the treasurer queue. §12 guardrail: the
  app records state; money moves in QuickBooks/the bank.
- Notifications: `REIMBURSEMENT_SUBMITTED` (to the area officer),
  `REIMBURSEMENT_TO_TREASURER` (on officer approval), `REIMBURSEMENT_RESOLVED`
  (to submitter, says reimbursed vs credited).
- UI: submit form (amount, receipts, officer-area picker) on the budget page or
  profile; officer queue on their proposal view; treasurer queue with
  pay/credit actions (credit flow picks the target payment assignment).
*Accept:* non-officer submits with receipt photo; area officer approves and pins
a line item; treasurer applies as credit → the brother's dues assignment
progress rises with a linked entry; a second request is marked reimbursed;
RLS blocks a random member from reading someone else's reimbursement.

---

### Phase 12 — Housing: v3 re-scope, points, live lottery

**DESIGN DECISIONS (layout pass with user, 2026-07-18/19):**
- **The lottery is OPTIONAL — one producer of room assignments, never the only
  path.** `room_assignments` is the canonical, method-agnostic table. Real
  world: summer boarders are assigned rooms directly by the house manager —
  paperwork collected first, room given based on the price paid, points
  irrelevant. Other organizations may never run a draft at all and decide
  rooms their own way. Direct assignment (task 14.1 UI + 12.1 write policies)
  is first-class; a term with no `housing_lotteries` row is perfectly normal.
  Nothing in the schema may assume assignments came from a draft.
- **Summer boarding flow = composition, no new tables:** paperwork gating is a
  requirements packet (task + payment requirements, same pattern as 14.2
  housing contracts); once complete, the house manager direct-assigns via
  14.1; the rate lives with the contract/payment requirement, and
  `room_assignments.notes` can carry the price tier.
- **All four lottery tables challenged and kept (2026-07-19), zero merges:**
  adjustments ledger kept as the *accountable* escape hatch (formula can't see
  house tradition; first lottery has no history; required reason + audit
  trigger beats invisible fudging) and NOT merged into
  requirement_progress_entries (different semantics); lotteries not polls
  (sequential public ordered picks ≠ simultaneous secret equal ballots) and
  not events (process, not calendar entry); entrants materialized because the
  activation-time snapshot/order freeze IS the feature; picks not merged into
  room_assignments (immutable draft history vs mutable roster — one table
  can't be append-only and editable; opposite RLS write rules). Names are
  already tradition-neutral; "Room Draw" etc. is a terminology label if a
  tenant wants it.

**12.1 Migration `housing_v3.sql` — re-scope facilities/rooms/room_assignments.**
Standalone prereq (Phases 13–14 also depend on it). `rooms` holds real Airtable
data — additive changes + policy swap only; snapshot row counts before/after.
- `ALTER TABLE facilities ADD COLUMN managed_by_group_id → groups`; backfill to the
  org's `housing_corp` group. Keep legacy columns for now.
- Drop the three old select policies; recreate: selects org-scoped via
  `get_my_organization_ids()` — **the rebuilt version from 8.9** (the original
  still reads the dropped `org_memberships` table) — so chapter AND SNHC see house
  + occupancy; writes
  (`facilities_update`, `rooms_*`, `room_assignments_*`) gated on
  `managed_by_group_id IN (get_my_module_admin_group_ids('house_manager'))` (join
  through `facility_id`). Room self-picks flow through the lottery trigger (12.3).
- Audit triggers on rooms + room_assignments.
*Accept:* chapter member reads rooms, cannot insert `room_assignments`; SNHC admin
and house-manager persona can; `rooms` row count unchanged.

**12.2 Points: adjustments ledger + pure calculator.**
Only manual adjustments materialized; activity points computed on read.
- `housing_point_adjustments`: `group_id`, `person_id`, `term_id null`,
  `amount NUMERIC` (signed), `reason TEXT NOT NULL`, `logged_by`, `created_at`.
  Select group members / writes house-manager gate / audit trigger.
  (Pattern: `20260707000001_progress_entries.sql`.)
- `lib/utils/housing/points.ts` (pure, unit-tested): `computePoints(inputs, config)`
  → `{ total, breakdown }`; weights for quota hours, attendance, completions,
  seniority-per-year; lookback terms. Defaults in `lib/constants/`; per-lottery
  override in `housing_lotteries.points_config`.
- `dal/housing.ts`: `getPointsInputsDal` (approved progress entries, attendance,
  completions, `started_at` seniority, adjustments), adjustment CRUD. Actions:
  `addPointAdjustment`, `getStandings`.
*Accept:* unit tests cover weight combos + negative adjustments; standings sorted
with breakdown for dev roster.

**12.3 Migration `housing_lottery.sql` — draft tables + DB-enforced turns.**
(Pattern: `20260707000003_voting.sql`.)
- `housing_lotteries`: `group_id`, `facility_id`, `term_id`, `status`
  (`draft/published/active/completed/cancelled`), `opens_at/closes_at`,
  `points_config jsonb` (incl. `pick_window_hours null` turn timer), `created_by`,
  `UNIQUE (group_id, facility_id, term_id)`.
- `housing_lottery_entrants`: `lottery_id`, `person_id`, `points_snapshot`,
  `points_breakdown jsonb` (frozen at activation), `draft_order`,
  `turn_started_at`, `status` (`eligible/skipped/picked/withdrawn`); unique person
  and order.
- `housing_lottery_picks`: `lottery_id`, `entrant_id`, `room_id`, `pick_number`,
  `picked_at`; unique entrant and pick_number. No UPDATE/DELETE (immutable).
- `current_lottery_turn(lottery_id)` SECURITY DEFINER: first unpicked by order,
  lazily treating expired `turn_started_at + pick_window_hours` as skipped (no cron).
  Picks INSERT policy: lottery `active` AND own entrant row AND (current turn OR turn
  already passed — skipped pick any time after) — OR house-manager gate (on-behalf).
- BEFORE INSERT trigger: capacity check (`COALESCE(ideal_capacity, capacity)` —
  verify against real data), assigns `pick_number`. AFTER INSERT SECURITY DEFINER
  trigger: entrant → `picked`, stamps next `turn_started_at`, inserts
  `room_assignments`. Single write path.
- Entrants/lottery RLS: select group members; writes house-manager gate. Audit
  triggers.
*Accept:* seeded 3-entrant lottery: out-of-turn pick rejected by RLS; in-turn creates
`room_assignments`; second pick violates unique.

**12.4 Lottery DAL/actions + officer UI.**
`dal/housing.ts`: `createLotteryDal`, `setEntrantsDal`, `activateLotteryDal`
(snapshot standings + order in one pass), `skipEntrantDal`, `completeLotteryDal`,
`getLotteryBoardDal` (one payload: lottery + entrants + picks + remaining rooms).
Officer UI `/[group]/housing/lottery` (gate `canManage('houseManager')`): create
(facility, term, window, weights, timer), standings preview with breakdown + inline
adjustments, publish, activate, skip / pick-on-behalf, complete.
*Accept:* create→preview→publish→activate on real rooms data; order stable.

**12.5 Member draft-day UI + notifications.**
**Polling, not Realtime**: `getLotteryBoard` polled every 3–5 s via
`useLotteryBoard(lotteryId)` hook (pause on `document.hidden`; hook isolates fetch so
Realtime can swap in later). Board: order with picked/current/upcoming, room grid
(number, sqft, beds, capacity), timer countdown, "you're up" banner, pick confirm →
`makePick` (RLS is the enforcement; action translates failures). Notifications
`LOTTERY_YOUR_TURN` (post-pick + on activate), `LOTTERY_COMPLETED`.
*Accept (phase exit):* two browsers, consecutive users: A picks, B updates within one
interval; B cannot take a full room; results view shows final assignments.

---

### Phase 13 — Issues (generalized service requests + cross-group escalation)

Depends only on 12.1 (can leapfrog 12.2–12.5 if priorities shift).

**DESIGN DECISION (layout pass with user, 2026-07-19): the table is `issues`,
not `facility_issues`.** Same playbook as events/subgroups: one generic table,
`kind` carries the variation (`maintenance` is just the first kind), links
that only apply to some kinds are nullable (`facility_id`, `room_id`).
Members can raise maintenance problems, safety concerns, equipment/tech
problems, or general operational issues through one pipeline: reported by a
member, assigned to a person, optionally escalated to another group.

**DECISION (2026-07-20): issues do NOT merge with requirements ("tasks"), and
`issues` is NOT renamed.** Challenged and settled. Requirements are
obligations pushed DOWN onto members (audience-expanded, term-scoped,
completion feeds national reporting/CSV export); issues travel UP (a member
reports a problem, it arrives unassigned, gets triaged to one owner, floats
free of terms, carries priority/kind/photos/room + cross-group escalation).
Opposite direction, opposite lifecycle, and merging would force an escalation
branch into requirements' most sensitive RLS. The `issues` name is already
correct — chores are NOT a kind of issue (see the chores note in §11), so
there is nothing broader to rename it to.
- **Sanctioned integration seam (build later, not a merge):** "issue → spawn
  requirement" — an officer turns an issue into a real task requirement
  targeted at a subgroup (due date, verification), linked back to the issue,
  which auto-resolves on completion. Exactly the shipped comment→requirement
  pattern; works BECAUSE the tables stay separate. A future "my work"
  dashboard section can UNION assigned issues + pending requirements for
  display only. (One instance of the source→requirement pattern — see the
  meeting/committee action-items note in §11 for the full set and the
  "requirements engine as universal task substrate" framing.)
- **Cleanup owed:** the legacy `tasks: true` feature flag in `OrgFeatures`
  (and the dev groups' data) is dead and invites exactly this confusion —
  delete it in the next cleanup pass.

**13.1 Migration `issues.sql`** (generalizes SPEC Part 11 house_issues):
- `issues`: `group_id` (reporting group),
  `kind` (`maintenance/safety/equipment/operations/other` — CHECK with `other`
  catch-all, house style like documents.kind), `facility_id null`,
  `room_id null` (facility/room only meaningful for facility-ish kinds),
  `location_note`, `title`, `description`, `photo_paths text[]`, `priority`
  (`low/medium/high/emergency`), `status`
  (`open/acknowledged/in_progress/resolved/wont_fix`),
  `reported_by → persons` (who submitted), `assigned_to → persons null`
  (who owns it), `escalated_to_group_id null` + `escalated_at/escalated_by`,
  `resolution_note`, `resolved_at`, timestamps.
- RLS: select = reporting OR escalated group; insert = reporting-group member with
  `reported_by = get_my_person_id()`; update = group admins of either group OR
  `get_my_module_admin_group_ids('house_manager')` (house managers triage
  without full admin; non-facility kinds triaged by admins); delete =
  reporting-group admins. Audit trigger.
- Storage bucket `issue-photos` (clone `20260708000003_profile_photos_storage.sql`
  policies; authenticated-only reads).
- Comments: add `'issue'` to CHECK + gate case granting both groups.
*Accept:* SNHC admin sees an escalated maintenance issue and can comment;
non-escalated invisible; an `operations` issue with no facility/room round-trips.

**13.2 DAL + actions + notifications.** `dal/issues.ts`: lists (ours +
escalated-to-us, filter by kind), detail, create, status update (Zod requires
`resolution_note` for resolved/wont_fix), assign, `escalateIssueDal` via
`getOverseeingGroupDal` (`group_relationships` child = groupId, active, slug
`'oversees'`) — first behavioral use of the oversight edge. Actions:
`reportIssue` (client Storage upload like profile photos), `updateIssueStatus`,
`assignIssue`, `escalateIssue`. Notifications: `ISSUE_REPORTED` (managers;
immediate for emergency), `ISSUE_STATUS_CHANGED` (reporter), `ISSUE_ASSIGNED`
(assignee), `ISSUE_ESCALATED` (escalated group's managers).
*Accept:* report→acknowledge→assign→escalate→resolve round trip with correct
notifications, including the assignee's.

**13.3 UI.** `/[parent]/[org]/[group]/issues`: member view (my issues + report
form: kind picker; facility/room picker appears for facility kinds; photos,
priority) and manage queue (admins + `canManage('houseManager')`: filters by
kind/status/priority, assign, transitions, escalate). Same page in SNHC context
shows their escalated queue — group-generic, no `group_type` branching.
Comments on detail. Sidebar link.
*Accept (phase exit):* phone-viewport maintenance report with photo; house
manager acknowledges, assigns + escalates; SNHC resolves with note; reporter's
bell link navigates correctly; a non-facility issue flows through the same
queue without facility fields.

---

### Phase 14 — Housing extras: room management + housing contracts + signing

**14.1 Room assignment management (direct assignment — first-class, NOT just
post-lottery).**
Depends only on 12.1 (write policies) — can ship before or without the lottery
tasks. This is the primary path for summer boarders (assign by price once
paperwork is in) and for any organization that decides rooms without a draft.
SNHC/house-manager UI on `/[group]/housing`: occupancy view per facility/term
(rooms × assignments), actions — assign a vacancy directly, end an assignment
(`ends_on`), swap two residents (one action, both rows). DAL on existing
`room_assignments` (writes already gated by 12.1). Audit trail comes free from
12.1's trigger.
*Accept:* house manager direct-assigns a summer boarder to a room with a note;
swap two residents; occupancy view and both member profiles reflect it;
a mid-term move-out frees the room in the next lottery's room grid.

**14.2 Migration `document_signing.sql` — signing schema.**
Adapted from the business-data-platform's `document_packages` / `document_signatures`
schema, simplified for chapter-level use (no PKI/certificates, no external e-sign
providers). Supports multi-signer sequential or parallel workflows on any document.
- `document_packages`: `id`, `document_id → documents`, `group_id → groups`,
  `signing_status` (`draft/sealed/pending_signatures/fully_signed/declined/expired/
  canceled`), `signing_order` (`parallel/sequential`), `signing_deadline date null`,
  `sealed_at/sealed_by` (frozen for signing), `completed_at`, `version int DEFAULT 1`,
  `superseded_by uuid null → document_packages`, `created_by → persons`, timestamps.
  UNIQUE `(document_id, version)`.
- `document_signatures`: `id`, `package_id → document_packages ON DELETE CASCADE`,
  `signer_person_id → persons`, `signer_email`, `signer_name`, `signer_role text null`
  (e.g. 'resident', 'house_manager'), `sign_order int` (for sequential),
  `status` (`requested/viewed/signed/declined/expired/revoked`),
  `document_hash_at_request text` (SHA-256 of the sealed document),
  `document_hash_at_signing text null` (SHA-256 at sign time — tamper detection),
  `consent_text text` (the "I agree to..." statement shown at signing),
  `ip_address inet null`, `user_agent text null`,
  `signed_at timestamptz null`, `viewed_at timestamptz null`, timestamps.
  UNIQUE `(package_id, signer_person_id)`.
- Immutability triggers (pattern: business-data-platform):
  - `prevent_package_reparenting()` — cannot change `document_id` after creation.
  - `guard_signature_columns()` — signers cannot modify `document_hash_*`,
    `ip_address`, `user_agent` after signing; only service_role or admin can.
  - `lock_signed_document()` — BEFORE UPDATE on `documents`: reject body/file
    changes if any linked `document_packages` has `signing_status` in
    (`sealed`, `pending_signatures`, `fully_signed`).
- RLS: selects = group members; package create/seal = house-manager gate
  (`get_my_module_admin_group_ids('house_manager')`); signature status updates
  (viewed/signed/declined) = own row only
  (`signer_person_id = get_my_person_id()` AND package `pending_signatures`).
  Audit triggers on both tables.
*Accept:* member cannot seal a package; signer can sign own row; signed document
body cannot be edited; hash mismatch detectable; RLS suite extended.

**14.3 Signing DAL + actions + notifications.**
`dal/document-signing.ts`: `createPackageDal`, `sealPackageDal` (compute SHA-256 of
document body/file, stamp `sealed_at`, set `document_hash_at_request` on all
signature rows, transition `draft→sealed→pending_signatures`),
`viewSignatureDal` (status→viewed, stamp `viewed_at`),
`signDal` (status→signed, stamp `signed_at`, capture IP/user-agent/consent text,
compute `document_hash_at_signing`, verify matches `_at_request` — reject on
mismatch; if all signatures signed → package `fully_signed` + `completed_at`),
`declineSignatureDal` (status→declined, package→declined),
`getPackageStatusDal` (one payload: package + all signature rows + document title).
Actions: `createSigningPackage`, `sealForSigning`, `recordSignatureView`,
`signDocument`, `declineDocument`. Zod validations.
Notifications: `SIGNATURE_REQUESTED` (each signer, sequential = only current;
parallel = all at seal), `DOCUMENT_SIGNED` (package creator when each signer
completes), `DOCUMENT_FULLY_SIGNED` (all signers + creator),
`SIGNATURE_DECLINED` (creator).
*Accept:* seal→view→sign round trip; IP + user agent captured; hash verified;
sequential signing sends notification only to current signer; decline notifies
creator.

**14.4 Housing contracts (composition using signing).**
"Create housing contract packet" guided action for a facility/term: uploads the
license agreement as a `documents` row, creates a `document_packages` with
`signing_order: 'parallel'`, adds `document_signatures` rows for each current
resident (resolved from `room_assignments` for the term) with
`signer_role: 'resident'` + a manager counter-signature row. Also creates a
`payment` requirement for room & board targeted at the house-residents subgroup
(tracking only, per §12 guardrail). A contracts panel shows per-resident
signing + payment status.
*Accept:* packet creation targets exactly the current residents; each resident
sees a "Sign housing agreement" action; house manager counter-signs; statuses
roll up on the panel; a resident sees the payment obligation on their
requirements page.

**14.5 Signing UI.**
Signing happens inline on the document detail page (`/[group]/documents/[id]`):
- Signer view: document content (read-only when sealed), consent statement,
  "I agree — Sign" button (confirmation dialog with consent text, captures
  IP/user-agent on submit). Status badge (requested/viewed/signed).
- Manager view: seal button, signing progress (who signed, who hasn't, timestamps),
  resend notification, cancel package.
- Signature audit trail: expandable log showing each signer's name, role, status,
  signed_at, IP (visible to admins only).
Patterns: document detail components in `components/documents/`.
*Accept (phase exit):* full cycle — upload contract, seal, residents sign from their
document view, manager counter-signs, fully_signed status; audit trail shows
all timestamps and IPs; resident who declines triggers notification to creator.

---

### Phase 15 — Term rollover wizard

A guided, **stateless** checklist page (state computed from data, nothing stored) for
group admins at `/[group]/admin` (new tab): the end-of-term transition in order —
1. Officer elections held (links to polls; manual check-off is fine for v1).
2. Position turnover — the one new mutation: bulk action ending current
   `position_assignments` (`term_end`) and creating next-term holders (pattern:
   `components/admin/admin-panel.tsx`).
3. Create + activate next term (exists — task 0.7 flow).
4. Clone requirements from previous term (exists — `cloneRequirementsFromTerm`, 1.5).
5. Archive recruitment: term purge of feedback (Phase 10's
   `purgeTermRecruitmentData`).
6. Open next budget cycle (create the new term's `budgets` row, Phase 11).
Each step shows computed done/not-done and deep-links to the feature.
*Accept:* running the wizard end-to-end in dev transitions Fall→Spring: new term
active, officers turned over, requirements cloned, rush feedback purged, new budget
in `drafting`.

---

### Adopted defaults (flag in PRs; user may veto)

- 8.4 digest email: `COALESCE(personal_email, school_email)`.
- 8.8 RLS suite runs against dev DB via `npm run test:rls`, excluded from
  `npm run check`.
- 9: module flags limited to the three existing `system_position_roles` booleans; no
  new permission tables. Existing features stay admin-gated.
- 10: rush feedback visible to all group members; append-only. Bid votes default
  supermajority secret ballot. Prospect row survives conversion; only feedback
  purged; term purge is manual, not cron.
- 11: `approver_position_id NULL` = any group admin; `approval_mode` default
  `'approver'`. Proposals support `subgroup_id` in schema; positions-only UI in v1.
- 12.1: org-wide select scope for housing (skip `can_view_housing` jsonb in RLS);
  keep legacy `facilities.managed_by_org_id` for now.
- 14.2–14.5: platform-native signing (simplified from business-data-platform — no PKI,
  no external providers); identity = session auth + IP/user-agent capture; no photo-ID
  verification in v1. Housing contracts compose signing + requirements (payment tracking
  only, per §12 guardrail).

### Execution protocol & verification

- First implementation step: append Phases 8–15 to `docs/PLAN.md` (user approval of
  this plan authorizes the scope edit); continue ledger discipline — one task per
  commit, `npm run check` green, schema tasks: `supabase db push` →
  `npm run types:db` → regenerate `schema-reference.sql`.
- Every accept criterion exercised in the running app per `docs/DEV.md` (test
  personas; **never email real roster addresses from dev** — rush invite testing on
  test/owner inboxes only; RLS verified as the restricted user, plus the 8.8 suite).
- Phase-exit E2E checks: 10.5, 11.4, 12.5, 13.3, 14.5 accepts, 15 wizard run.

### Critical files

- `actions/utils/action-helpers.ts`, `actions/utils/action-core.ts` — 8.1 refactor
- `supabase/migrations/20260708000001_auth_user_id_decoupling.sql` — RLS helper
  patterns (9.1 models on it)
- `supabase/migrations/20260707000004_documents_comments.sql` — lifecycle +
  poll-link + comment-gate pattern (budgets, issues)
- `dal/polls.ts`, `actions/polls.action.ts` — poll wiring reused for bid votes and
  budget ratification
- `actions/members/invite-member.action.ts` + claim flow — conversion machinery (10.4)
- `lib/utils/permissions.ts` — extended, not reimplemented, in 9.2
- `supabase/migrations/20260404000006_architecture_v2.sql` — pre-v3 housing RLS that
  12.1 replaces
- `dal/documents.ts`, `dal/requirements.ts`, `dal/group-context.ts` — DAL patterns
- Business-data-platform signing schema reference:
  `C:\Users\pires\Projects\Git Clones\business-data-platform\supabase\migrations\00050_documents_extensions.sql`
  (lines 223–411: `document_packages`, `document_signatures`, immutability triggers)
  and `src\dal\documents\document-signatures.ts` (DAL pattern for 14.3)
