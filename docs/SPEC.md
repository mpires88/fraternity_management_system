# Chapter Management Platform — Product Specification v5

## Overview

White-label, multi-tenant web application for Greek and similar organizations. Supports undergraduate chapters, housing corporations, alumni chapters, advisory boards, and more.

**Stack:** Next.js 14 (App Router) · Supabase · Tailwind CSS · shadcn/ui · Vercel · Resend

---

## Part 1: Platform Architecture

### Four-Level Hierarchy

```
Platform (you — manages fraternities, billing, platform config)
  └── Fraternity (e.g. Alpha Beta Gamma — shared person registry)
        └── Org (e.g. Undergraduate Chapter, Housing Corp)
              └── Affiliation (person's relationship to one org)
```

### Key Architectural Decisions

- **One login per human** — one person record per fraternity, multiple org affiliations
- **Terms replace semesters** — orgs define their own term structure; `term_id` is the universal foreign key
- **Affiliation types + statuses replace hardcoded roles** — flexible, org-defined system (see Part 3)
- **System position roles** — stable machine-readable identifiers regardless of what an org calls a position
- **National org templates** — seed positions, affiliation types, and subgroups for known organizations
- **Feature flags** — each org enables only the features it needs
- **White-label** — fraternity subdomain + configurable branding

### URL Structure

```
app.platform.com/[fraternity-slug]/[org-slug]/[feature]

Examples:
  alpha-beta-gamma.platform.com/undergrad/budget
  alpha-beta-gamma.platform.com/housing/elections
  alpha-beta-gamma.platform.com/undergrad/subgroups/social
```

### Login & Org Switching

- Person logs in at fraternity subdomain
- App fetches person record and all org_affiliations
- One org → redirect directly to that org's dashboard
- Multiple orgs → redirect to unified home screen
- Org context switcher in top-left of sidebar nav (Slack-style)

---

## Part 2: Term Structure

Every org defines its own term structure. "Semester" is not a platform concept. All tables use `term_id uuid references terms(id)` instead of `semester text + year int`.

### term_definitions (the template)

```sql
create table term_definitions (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id) not null,
  name                  text not null,        -- "Fall", "Spring", "Q1", "Fiscal Year"
  slug                  text not null,        -- unique per org
  ordinal               int not null,         -- display order within a year
  start_month           int not null,
  start_day             int not null,
  end_month             int not null,
  end_day               int not null,
  has_elections         boolean default true,
  has_budget            boolean default true,
  has_rollover          boolean default true,
  has_rush              boolean default false,
  officer_selection     text check (officer_selection in ('elected','appointed','carried_over')) default 'elected',
  auto_generate         boolean default true,
  generate_months_ahead int default 2,
  is_active             boolean default true,
  unique (org_id, slug)
);
```

### terms (instantiated records)

```sql
create table terms (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid references orgs(id) not null,
  definition_id     uuid references term_definitions(id) not null,
  name              text not null,   -- "Fall 2025", "Q1 2026", "Fiscal Year 2025"
  year              int not null,
  starts_on         date not null,
  ends_on           date not null,
  status            text check (status in ('upcoming','active','completed')) default 'upcoming',
  -- snapshot of definition settings at generation time
  has_elections     boolean not null,
  has_budget        boolean not null,
  has_rollover      boolean not null,
  has_rush          boolean not null,
  officer_selection text not null,
  unique (org_id, definition_id, year)
);
```

### Starter Templates

| Template | Terms Created | Notes |
|----------|--------------|-------|
| Semester (2-term) | Fall + Spring | Most undergraduate chapters |
| Semester + Summer | Fall + Spring + Summer | Chapters with summer house operations |
| Trimester | T1 + T2 + T3 | Some academic calendars |
| Quarter | Q1 + Q2 + Q3 + Q4 | Quarter-system schools |
| Annual | Fiscal Year | Alumni chapters, housing corps, advisory boards |
| Custom | Admin defines from scratch | Full flexibility |

### Auto-Generation

Monthly cron job generates upcoming terms within each org's `generate_months_ahead` window. Rollover prompts fire when a term's `ends_on` is within 14 days — purely date-driven, works for any term structure.

### Tables Using term_id

All replace `semester text + year int`:
`position_assignments`, `budgets`, `elections`, `rush_settings`, `rush_prospects`, `participation_rulesets`, `room_assignments`, `financial_contracts`, `semester_rollovers` (from_term_id + to_term_id), `events`

---

## Part 3: People, Affiliations & Status

This is the most important part of the model to understand. "Users" in this platform are composed of three concepts: the person (who they are), the affiliation (their relationship to an org), and their status (their current standing).

### The Core Distinction

```
persons          — who you are (fraternity-level, one record per human)
org_affiliations — your relationship to a specific org
                   ├── affiliation_type: member | advisor
                   ├── base_status: platform-defined
                   └── extended_status: org-defined, layered on top
```

### persons (fraternity-level identity)

```sql
create table persons (
  id                     uuid references auth.users primary key,
  fraternity_id          uuid references fraternities(id) not null,
  full_name              text not null,
  email                  text not null,
  phone                  text,
  personal_email         text,
  address                text,
  emergency_contact      text,
  profile_photo          text,
  bio                    text,
  nickname               text,
  date_of_birth          date,
  pledge_class_id        uuid references pledge_classes(id),
  big_id                 uuid references persons(id),  -- self-referencing Big/Little
  initiation_date        date,
  member_number          text,
  expected_grad_year     int,    -- used by rollover to suggest alumni conversion
  major                  text,
  quickbooks_customer_id text,
  quickbooks_vendor_id   text,
  created_at             timestamptz default now()
);
```

**Key rule:** Person records are never deleted. Even if someone is expelled, their record — Big, Little, pledge class, initiation date — is preserved. Only their access is removed.

### org_affiliations

```sql
create table org_affiliations (
  id                  uuid primary key default gen_random_uuid(),
  person_id           uuid references persons(id) not null,
  org_id              uuid references orgs(id) not null,
  affiliation_type    text check (affiliation_type in ('member','advisor')) not null,
  base_status         text check (base_status in (
                        'active',     -- in good standing, full participation
                        'candidate',  -- pledge / new member in process
                        'away',       -- good standing but temporarily away
                        'expelled'    -- permanently removed
                      )) not null default 'active',
  extended_status_id  uuid references org_extended_statuses(id),
  joined_at           date,
  notes               text,
  created_at          timestamptz default now(),
  unique (person_id, org_id)
);
```

### Affiliation Types

**Member** — formal member of the organization. Has base statuses and org-defined extended statuses.

**Advisor** — affiliated but not a member. Examples: faculty advisor, alumni advisor, community volunteer. Has their own permission profile and simpler status model (active / inactive).

Future types orgs can define: Stakeholder, Vendor, Observer, Honorary — all handled through org-defined affiliation types in a later phase.

---

## Part 4: Status Model

### Base Statuses (platform-defined, universal)

These four exist in every org and cannot be removed or renamed. Their meaning is fixed.

| Status | Meaning | Key Rules |
|--------|---------|-----------|
| active | In good standing, full participation | Permissions configurable per org |
| candidate | In membership process (pledge) | Permissions configurable per org |
| away | Good standing, temporarily away from school/location | can_hold_office always false |
| expelled | Permanently removed from organization | Always zero access. Cannot be reversed in app. |

**Active and expelled are not configurable** — Active always grants full member access as defined by the org, expelled always grants zero access regardless of any other setting.

**Candidate and away have configurable permissions** — the admin sets these when creating the org from a national template or from scratch.

### Extended Statuses (org-defined, layered on top)

Orgs create their own extended statuses to model their specific reality. These layer on top of base_status — both apply simultaneously.

```sql
create table org_extended_statuses (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id) not null,
  name                  text not null,       -- "Alumni", "Alumnae", "Suspended", "Probated"
  slug                  text not null,       -- "alumni", "suspended", "probated"
  description           text,
  -- which base statuses this extended status can be applied to
  applicable_to         text[] not null,     -- ["active"] or ["active","away","alumni"]
  -- permission overrides (null = inherit from base status permissions)
  can_vote              boolean,
  can_hold_office       boolean,
  can_attend_events     boolean,
  can_view_roster       boolean,
  can_view_financials   boolean,
  can_submit_expenses   boolean,
  can_view_minutes      boolean,
  can_speak_at_meetings boolean,
  can_view_documents    boolean,
  -- suspension fields
  is_suspension         boolean default false,
  suspension_workflow   text check (suspension_workflow in (
                          'disciplinary',   -- honor board process (active members)
                          'administrative', -- leadership decision (alumni, advisors)
                          'national'        -- national org involvement
                        )),
  -- graduation field
  is_graduation_status  boolean default false,  -- rollover uses this to suggest alumni conversion
  -- display
  color                 text,
  display_order         int,
  is_seeded             boolean default false,  -- from national template, can rename but not delete
  is_active             boolean default true,
  unique (org_id, slug)
);
```

### How Alumni Works

Alumni is an **extended status**, not a separate affiliation type. You remain a member — your relationship to the org didn't change, your standing did.

```
base_status:     active          (you're still a member)
extended_status: alumni          (you graduated — org-defined)

Effect: alumni permission profile applies instead of active profile
  → can view roster, some announcements, invited events
  → cannot vote, hold office, see financials, submit expenses
```

Alumni can be further modified by another extended status — for example, an alumnus who does something post-graduation:

```
base_status:     active
extended_status: alumni_suspended   (applies to: ["alumni"])

Effect: suspended overrides alumni
  → zero access
  → different workflow than active member suspension
```

### The Two Suspension Workflows

**Disciplinary suspension** (active members, candidates)
- Goes through the honor board
- Formal process: complaint → 72-hour notice → hearing → decision
- Has defined duration (max 120 days per Sigma Nu bylaws)
- Automatic reinstatement task created
- Links to honor board case via `related_case_id`

**Administrative suspension** (alumni, advisors)
- Leadership decision — no formal hearing required
- Exec or alumni chapter leadership sets the status
- No automatic reinstatement — manual review required
- National org notified if configured
- Simpler audit trail

### Base Status Permissions

Configurable per org (except expelled which is always zero):

```sql
create table org_base_status_permissions (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id) not null,
  base_status           text check (base_status in ('active','candidate','away','expelled')) not null,
  can_vote              boolean not null,
  can_hold_office       boolean not null,
  can_attend_events     boolean not null,
  can_view_roster       boolean not null,
  can_view_financials   boolean not null,
  can_submit_expenses   boolean not null,
  can_view_minutes      boolean not null,
  can_speak_at_meetings boolean not null,
  can_view_documents    boolean not null,
  unique (org_id, base_status)
);
```

### Sigma Nu Undergraduate — Seeded Base Status Permissions

| Permission | Active | Candidate | Away | Expelled |
|---|---|---|---|---|
| can_vote | yes | yes* | no | no |
| can_hold_office | yes | no | no | no |
| can_attend_events | yes | yes | yes | no |
| can_view_roster | yes | yes | yes | no |
| can_view_financials | no | no | no | no |
| can_submit_expenses | yes | no | no | no |
| can_view_minutes | yes | yes | yes | no |
| can_speak_at_meetings | yes | yes | no | no |
| can_view_documents | yes | yes | yes | no |

*Candidates can vote on motions and bills per Sigma Nu bylaws — this is org-configurable.

### Sigma Nu Undergraduate — Seeded Extended Statuses

| Status | Applies To | Suspension | Workflow | Graduation Status |
|--------|-----------|-----------|---------|-----------------|
| Alumni Brother | active | no | — | yes |
| Probated | active, candidate | no | — | no |
| Suspended (disciplinary) | active, candidate, away | yes | disciplinary | no |
| Alumni Suspended | alumni | yes | administrative | no |

### Status History (full audit trail)

```sql
create table affiliation_status_history (
  id                   uuid primary key default gen_random_uuid(),
  affiliation_id       uuid references org_affiliations(id) not null,
  changed_by           uuid references persons(id),  -- null = system
  old_base_status      text,
  new_base_status      text,
  old_extended_status  uuid references org_extended_statuses(id),
  new_extended_status  uuid references org_extended_statuses(id),
  reason               text,
  effective_date       date not null,
  notes                text,
  workflow             text,        -- which workflow governed this change
  related_case_id      uuid,        -- links to honor board case if disciplinary
  created_at           timestamptz default now()
);
```

### Permission Resolution

```typescript
// lib/utils/permissions.ts
export const getEffectivePermissions = (
  affiliation: OrgAffiliation,
  basePerms: OrgBaseStatusPermissions,
  extendedStatus?: OrgExtendedStatus
) => {
  // Expelled: always no access, no exceptions
  if (affiliation.base_status === 'expelled') return NO_ACCESS

  // Start with base status permissions
  let perms = { ...basePerms }

  // Apply extended status overrides (null = inherit from base)
  if (extendedStatus) {
    perms = {
      can_vote:              extendedStatus.can_vote              ?? perms.can_vote,
      can_hold_office:       extendedStatus.can_hold_office       ?? perms.can_hold_office,
      can_attend_events:     extendedStatus.can_attend_events     ?? perms.can_attend_events,
      can_view_roster:       extendedStatus.can_view_roster       ?? perms.can_view_roster,
      can_view_financials:   extendedStatus.can_view_financials   ?? perms.can_view_financials,
      can_submit_expenses:   extendedStatus.can_submit_expenses   ?? perms.can_submit_expenses,
      can_view_minutes:      extendedStatus.can_view_minutes      ?? perms.can_view_minutes,
      can_speak_at_meetings: extendedStatus.can_speak_at_meetings ?? perms.can_speak_at_meetings,
      can_view_documents:    extendedStatus.can_view_documents    ?? perms.can_view_documents,
    }
  }

  return perms
}
```

### Real-World Examples

**Example 1 — Undergraduate who graduates**
```
base_status:     active → active   (unchanged — still a member)
extended_status: null   → alumni   (admin marks as graduated)

Trigger: rollover wizard surfaces members where expected_grad_year <= current year
Action:  admin confirms → extended_status set to alumni → access updated immediately
```

**Example 2 — Brother expelled junior year**
```
base_status:     active → expelled  (honor board decision)
extended_status: null   → null      (irrelevant)

Person record:   preserved — Big, Little, pledge class, initiation date all intact
Access:          zero — expelled base_status = NO_ACCESS, full stop
Directory:       configurable — admin decides if expelled members appear to others
```

**Example 3 — Alumni suspended post-graduation**
```
base_status:     active (unchanged)
extended_status: alumni → alumni_suspended

Workflow:        administrative (not disciplinary — different process)
Access:          zero until manually reviewed and resolved
Reinstatement:   manual — no automatic timeline
```

**Example 4 — Former advisor, now inactive**
```
org_affiliations (this org): affiliation_type=advisor, base_status=active → away/inactive
org_affiliations (other org): affiliation_type=advisor, base_status=active  ← unaffected

Each org's affiliation is completely independent.
```

### Graduation Workflow

The system identifies likely graduates and surfaces them for admin confirmation — never auto-converts without admin approval.

**Rollover path (each term):**
```
Rollover wizard opens
  └── System finds active members where expected_grad_year <= current year
  └── Shows list: "These members may have graduated — confirm or skip each"
  └── Admin confirms → extended_status set to is_graduation_status=true status
  └── affiliation_status_history row written automatically
  └── Member notified: "Your account has been updated to Alumni status"
```

**Manual path (anytime):**
```
Admin opens member profile
  └── Clicks "Mark as graduated"
  └── Confirms graduation date
  └── extended_status set to alumni immediately
  └── affiliation_status_history row written
  └── Member notified
```

---

## Part 5: Core Schema Tables

### fraternities

```sql
create table fraternities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  logo_url   text,
  created_at timestamptz default now()
);
```

### orgs

```sql
create table orgs (
  id            uuid primary key default gen_random_uuid(),
  fraternity_id uuid references fraternities(id) not null,
  name          text not null,
  slug          text not null,
  org_type      text not null,
  features      jsonb default '{}',
  settings      jsonb default '{}',
  created_at    timestamptz default now(),
  unique (fraternity_id, slug)
);
```

### Feature Flags (orgs.features)

| Flag | Controls | Undergrad | Housing | Alumni Ch. | Advisory |
|------|---------|-----------|---------|-----------|----------|
| members | Member directory | yes | yes | yes | yes |
| announcements | Announcements feed | yes | yes | yes | yes |
| documents | Document storage | yes | yes | yes | yes |
| meetings | Meeting scheduling + minutes | yes | yes | yes | yes |
| events | Event calendar + attendance | yes | yes | yes | yes |
| budget | Budget + expenses | yes | yes | yes | no |
| dues | Dues tracking | yes | no | yes | no |
| elections | Full election system | yes | yes | yes | no |
| voting | Standalone voting | yes | yes | yes | no |
| house | Rooms + chores + issues | yes | yes | no | no |
| rush | Prospect tracking | yes | no | no | no |
| tasks | Unified task engine | yes | yes | yes | yes |
| subgroups | Committees + cohorts | yes | yes | yes | no |

---

## Part 6: Position System & National Org Registry

### System Position Roles

Stable machine-readable identifiers that decouple system behavior from position names. "Commander" and "President" both map to `presiding_officer` — all system logic works correctly regardless of local naming.

```sql
create table system_position_roles (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text unique not null,
  default_name         text not null,
  description          text,
  is_presiding_officer boolean default false,
  is_treasurer         boolean default false,
  is_secretary         boolean default false,
  is_vice_president    boolean default false,
  is_house_manager     boolean default false,
  is_rush_chair        boolean default false,
  is_required          boolean default false
);

-- Seed data
insert into system_position_roles (slug, default_name, is_presiding_officer, is_required) values
  ('presiding_officer', 'President',      true,  true),
  ('vice_president',    'Vice President', false, true),
  ('treasurer',         'Treasurer',      false, true),
  ('secretary',         'Secretary',      false, true),
  ('house_manager',     'House Manager',  false, false),
  ('rush_chair',        'Rush Chair',     false, false);
```

**Sentinel is NOT a system position role** — it is specific to Sigma Nu. The honor board subgroup has a configurable `head_position_id`.

### positions

```sql
create table positions (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid references orgs(id) not null,
  title                text not null,    -- "Commander" — admin sets this
  slug                 text not null,
  system_role_id       uuid references system_position_roles(id),  -- null for custom
  type                 text check (type in ('exec','committee','house','board','other')),
  permission_level     text check (permission_level in ('exec','officer')),
  max_holders          int default 1,
  has_budget           boolean default false,
  is_presiding_officer boolean default false,
  semester_scope       text[],
  officer_selection    text check (officer_selection in ('elected','appointed','carried_over')),
  is_locked            boolean default false,
  can_rename           boolean default true,
  display_order        int,
  unique (org_id, slug)
);
```

### position_assignments

```sql
create table position_assignments (
  id          uuid primary key default gen_random_uuid(),
  position_id uuid references positions(id) not null,
  person_id   uuid references persons(id) not null,
  org_id      uuid references orgs(id) not null,
  term_id     uuid references terms(id) not null,
  term_start  date,
  term_end    date,   -- null = currently active
  is_acting   boolean default false,
  assigned_by uuid references persons(id)
);
```

### System Role Lookup View

```sql
create view current_system_role_holders as
select
  pa.org_id,
  spr.slug         as system_role,
  pa.person_id,
  p.full_name,
  pos.title        as position_title   -- "Commander", "President", etc.
from position_assignments pa
join positions pos on pos.id = pa.position_id
join system_position_roles spr on spr.id = pos.system_role_id
join persons p on p.id = pa.person_id
where pa.term_end is null;

-- Usage: find treasurer regardless of what the org calls the role
select * from current_system_role_holders
where org_id = $org_id and system_role = 'treasurer';
```

### National Org Registry

```sql
create table national_organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  abbreviation text,
  org_type     text not null,
  founded_year int,
  website      text,
  logo_url     text,
  status       text check (status in ('active','pending','inactive')) default 'active',
  submitted_by uuid references persons(id),
  approved_by  uuid references persons(id)
);

create table national_org_templates (
  id                 uuid primary key default gen_random_uuid(),
  national_org_id    uuid references national_organizations(id) not null,
  chapter_type       text not null,
  display_name       text not null,
  default_features   jsonb not null,
  term_structure     text,
  is_default         boolean default false
);
```

### Sigma Nu Undergraduate — Positions

| Position | System Role | Type | Selection | Term Scope |
|----------|-------------|------|-----------|------------|
| Commander | presiding_officer | exec | elected | fall, spring |
| Lieutenant Commander | vice_president | exec | elected | fall, spring |
| Treasurer | treasurer | exec | elected | fall, spring |
| Recorder | secretary | exec | elected | fall, spring |
| Marshal | — | exec | elected | fall, spring |
| Risk Reduction Chairman | — | committee | elected | fall, spring |
| Rush Chairman | rush_chair | committee | elected | fall, spring |
| House Manager | house_manager | committee | elected | fall, spring |
| Chaplain | — | committee | elected | fall, spring |
| Social Chairman | — | committee | elected | fall, spring |
| Steward | — | committee | elected | fall, spring |
| Sentinel | — | committee | appointed | fall, spring |
| Assistant Treasurer | — | committee | appointed | fall, spring |
| Athletics Chairman | — | committee | appointed | fall, spring |
| Assistant House Manager | — | house | appointed | fall, spring |
| IRDF Manager | — | committee | appointed | fall, spring |
| Summer House Manager | house_manager | house | appointed | summer |
| Summer Treasurer | treasurer | committee | appointed | summer |
| Summer Occupancy Chair | — | committee | appointed | summer |

---

## Part 7: Subgroups

Named member subsets within an org. Own resources by tagging with `subgroup_id`. Exec always has full visibility.

```sql
create table subgroups (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references orgs(id) not null,
  name             text not null,
  slug             text not null,
  subgroup_type    text check (subgroup_type in ('committee','exec_board','pledge_class','house_residents','ad_hoc')),
  membership_type  text check (membership_type in ('appointed','elected','open','invite_only','automatic')),
  head_position_id uuid references positions(id),
  pledge_class_id  uuid references pledge_classes(id),
  is_private       boolean default false,
  is_locked        boolean default false,
  can_rename       boolean default true,
  unique (org_id, slug)
);

create table subgroup_members (
  id           uuid primary key default gen_random_uuid(),
  subgroup_id  uuid references subgroups(id) not null,
  person_id    uuid references persons(id) not null,
  role         text check (role in ('head','member')) default 'member',
  join_type    text check (join_type in ('appointed','elected','self_joined','invited','automatic')),
  appointed_by uuid references persons(id),
  joined_at    date default current_date,
  left_at      date,
  unique (subgroup_id, person_id)
);
```

### Automatic Population (via triggers)

- **exec_board** — trigger on position_assignments when term_end set or cleared
- **house_residents** — trigger on room_assignments when ends_on set or cleared
- **pledge_class** — trigger on persons when pledge_class_id set

### Sigma Nu Standing Committees

| Subgroup | Type | Head Position |
|----------|------|--------------|
| Executive Committee | exec_board | commander |
| Housing Committee | committee | house_manager |
| Honor Board | committee | sentinel |
| Rush Committee | committee | rush_chair |
| Risk Reduction Committee | committee | risk_reduction |
| Candidate Education Committee | committee | marshal |
| Social Committee | committee | social_chair |
| Community Service Committee | committee | community_service |

---

## Part 8: Finance & Budgets

### Budget Ratification Workflow

1. Each officer/committee head with `has_budget = true` drafts proposal per term
2. Proposals contain line items with descriptions, amounts, categories
3. Admin submits — chapter votes at a meeting to ratify
4. Once ratified budget is locked; expense requests submitted against line items

```sql
create table budgets (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references orgs(id) not null,
  term_id      uuid references terms(id) not null,
  subgroup_id  uuid references subgroups(id),
  status       text check (status in ('drafting','submitted','ratified')) default 'drafting',
  ratified_at  timestamptz,
  meeting_date date,
  unique (org_id, term_id, subgroup_id)
);

create table budget_proposals (
  id              uuid primary key default gen_random_uuid(),
  budget_id       uuid references budgets(id) not null,
  position_id     uuid references positions(id),
  subgroup_id     uuid references subgroups(id),
  submitted_by    uuid references persons(id) not null,
  status          text check (status in ('draft','submitted')) default 'draft',
  total_requested numeric(10,2) default 0,
  overspend_total numeric(10,2) default 0
);

create table budget_line_items (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid references budget_proposals(id) not null,
  description text not null,
  amount      numeric(10,2) not null,
  category    text,
  notes       text
);

create table expense_requests (
  id               uuid primary key default gen_random_uuid(),
  line_item_id     uuid references budget_line_items(id),
  submitted_by     uuid references persons(id) not null,
  amount           numeric(10,2) not null,
  receipt_url      text,
  status           text check (status in ('draft','submitted','approved','rejected','reimbursed')) default 'draft',
  reviewed_by      uuid references persons(id),
  rejection_reason text,
  reimbursed_by    uuid references persons(id),
  payment_method   text,
  is_over_budget   boolean default false,
  overspend_note   text,
  created_at       timestamptz default now()
);
```

### Overspend Escalation

| Tier | Trigger | Action |
|------|---------|--------|
| 1 | Any overspend | Warning badge on dashboard. Overspend note required. |
| 2 | On approval | Treasurer + presiding officer notified. No action required. |
| 3 | >10%/>$100 over proposal; >25%/>$50 on line item | All exec notified. Flagged for reconciliation. Configurable. |

### Financial Contracts

```sql
create table financial_contracts (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid references orgs(id) not null,
  person_id          uuid references persons(id) not null,
  contract_type      text check (contract_type in ('dues','housing','fine_repayment','other')),
  title              text not null,
  total_amount       numeric(10,2) not null,
  term_id            uuid references terms(id),
  room_assignment_id uuid references room_assignments(id),
  starts_on          date not null,
  ends_on            date,
  has_payment_plan   boolean default false,
  member_signed_at   timestamptz,
  member_ip          text,
  officer_id         uuid references persons(id),
  officer_signed_at  timestamptz,
  status             text check (status in ('draft','pending_member','pending_officer','active','completed','defaulted','voided')) default 'draft',
  defaulted_at       timestamptz,
  defaulted_reason   text,
  created_at         timestamptz default now()
);

create table contract_payments (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid references financial_contracts(id) not null,
  due_date    date not null,
  amount      numeric(10,2) not null,
  status      text check (status in ('pending','paid','overdue','waived')) default 'pending',
  paid_at     timestamptz,
  recorded_by uuid references persons(id),
  notes       text
);
```

Defaulted contracts auto-create a high-priority task assigned to the treasurer system role.

---

## Part 9: Elections & Governance

```sql
create table elections (
  id                           uuid primary key default gen_random_uuid(),
  org_id                       uuid references orgs(id) not null,
  term_id                      uuid references terms(id) not null,
  name                         text not null,
  election_type                text check (election_type in ('slate','individual','mixed')),
  status                       text check (status in ('configuring','nominations_open','nominations_closed','voting_open','voting_closed','certified','seeded')) default 'configuring',
  self_nomination              boolean default true,
  member_nomination            boolean default true,
  eligible_base_statuses       text[],   -- which base_statuses can vote e.g. ["active"]
  eligible_extended_status_ids uuid[],   -- specific extended statuses that can vote
  win_condition_id             uuid references election_win_conditions(id),
  runoff_enabled               boolean default true
);

create table election_nominations (
  id                    uuid primary key default gen_random_uuid(),
  election_pos_id       uuid references election_positions(id) not null,
  nominee_id            uuid references persons(id) not null,
  nominated_by          uuid references persons(id) not null,
  accepted              boolean,
  platform_body         text,         -- rich text platform statement
  platform_submitted_at timestamptz,
  platform_visible_at   timestamptz,  -- controlled by presiding officer
  withdrawn             boolean default false,
  unique (election_pos_id, nominee_id)
);
```

**Voting eligibility** now checks base_status and extended_status rather than hardcoded role strings. For Sigma Nu: `eligible_base_statuses = ["active","candidate"]` (both can vote per bylaws), `eligible_extended_status_ids` excludes suspended statuses automatically.

### Semester Rollover

| Phase | Name | Actions |
|-------|------|---------|
| Pre | Admin preview | Reviews graduating members, expiring affiliations, election status |
| 1 | Status transitions | System surfaces members where expected_grad_year <= current year. Admin confirms each one. Confirmed → extended_status set to alumni. affiliation_status_history written. |
| 2 | Officer transition | Elections seed incoming officers (is_acting=true). Overlap period. Handoff promotes incoming, archives outgoing. |
| 3 | New term setup | Budget cycle opened. Officers notified. Rush records archived. |

---

## Part 10: Events, Calendar & House Operations

### Events

```sql
create table events (
  id                           uuid primary key default gen_random_uuid(),
  org_id                       uuid references orgs(id) not null,
  term_id                      uuid references terms(id),
  subgroup_id                  uuid references subgroups(id),
  category_id                  uuid references event_categories(id),
  title                        text not null,
  description                  text,
  starts_at                    timestamptz not null,
  ends_at                      timestamptz,
  location                     text,
  attendance_required          boolean default false,
  eligible_base_statuses       text[],   -- which statuses expected to attend
  budget_line_item_id          uuid references budget_line_items(id),
  status                       text check (status in ('draft','published','in_progress','completed','cancelled')) default 'draft',
  requires_cleanup_plan        boolean default false,
  cleanup_plan_due_at          timestamptz,
  -- minutes
  minutes_body                 text,
  minutes_status               text check (minutes_status in ('draft','circulated','under_review','corrections_applied','approved','published')),
  minutes_author_id            uuid references persons(id),
  minutes_author_override_id   uuid references persons(id),
  minutes_author_override_by   uuid references persons(id),
  minutes_author_override_at   timestamptz,
  minutes_approved_at          timestamptz,
  minutes_approved_by          uuid references persons(id),
  minutes_approved_at_event_id uuid references events(id),
  minutes_published_at         timestamptz
);
```

### Meeting Minutes Workflow

| Status | Who Acts | What Happens |
|--------|----------|-------------|
| draft | Secretary (or override) | Writing after meeting. Author and exec only. |
| circulated | Secretary | Shared before next meeting. Members notified. |
| under_review | Presiding officer | Corrections recorded in real time. |
| corrections_applied | Secretary | All corrections made. |
| approved | Presiding officer | Chapter voted. Body locked by trigger. approved_at_event_id set. |
| published | Officer | Visible to all eligible affiliates including alumni. |

### Secretary Override

- Presiding officer reassigns minutes authorship for a single meeting
- Identified via `is_presiding_officer` system role — works regardless of title
- Cannot be changed after minutes reach `approved` status
- Published footer: "Recorded by [name] (acting) · Assigned by [president]"

### Event Cleanup Plan Workflow

```sql
create table event_cleanup_plans (
  id                      uuid primary key default gen_random_uuid(),
  event_id                uuid references events(id) not null,
  submitted_by            uuid references persons(id) not null,
  description             text not null,
  assignments             jsonb,   -- [{person_id, area, notes}]
  status                  text check (status in ('draft','submitted','approved','rejected','revision_requested','cleanup_complete','cleanup_failed')) default 'draft',
  reviewed_by             uuid references persons(id),
  reviewer_override_id    uuid references persons(id),
  rejection_reason        text,
  completion_confirmed_by uuid references persons(id),
  completion_confirmed_at timestamptz,
  cleanup_due_at          timestamptz   -- typically ends_at + 24 hours
);
```

---

## Part 11: House Management

House record lives at the fraternity level — shared across orgs.

```sql
create table house (
  id                uuid primary key default gen_random_uuid(),
  fraternity_id     uuid references fraternities(id) not null,
  name              text not null,
  address           text,
  managed_by_org_id uuid references orgs(id)
);

create table rooms (
  id            uuid primary key default gen_random_uuid(),
  house_id      uuid references house(id) not null,
  name          text not null,
  type          text check (type in ('single','double','common','bathroom','storage')),
  floor         int,
  capacity      int default 1,
  is_active     boolean default true,
  display_order int
);

create table room_assignments (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid references rooms(id) not null,
  member_id uuid references persons(id) not null,
  term_id   uuid references terms(id) not null,
  starts_on date not null,
  ends_on   date,
  notes     text,
  unique (room_id, member_id, term_id)
);
```

Capacity enforced by database trigger. Room assignments trigger sync to `house_residents` subgroup.

### Chores

```sql
create table chores (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid references orgs(id) not null,
  name           text not null,
  area_id        uuid references rooms(id),
  chore_type     text check (chore_type in ('recurring','one_off')),
  frequency      text check (frequency in ('weekly','biweekly','monthly')),
  rotation_type  text check (rotation_type in ('automatic','manual')),
  eligible_scope text check (eligible_scope in ('residents','all_members')) default 'residents',
  is_active      boolean default true
);

create table chore_assignments (
  id            uuid primary key default gen_random_uuid(),
  chore_id      uuid references chores(id) not null,
  member_id     uuid references persons(id) not null,
  due_date      date not null,
  status        text check (status in ('pending','completed','incomplete','excused')) default 'pending',
  signed_off_by uuid references persons(id),
  signed_off_at timestamptz,
  notes         text
);
```

### House Issues

```sql
create table house_issues (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references orgs(id) not null,
  room_id         uuid references rooms(id),
  location_note   text,
  title           text not null,
  description     text,
  photo_urls      text[],
  priority        text check (priority in ('low','medium','high','emergency')) default 'medium',
  status          text check (status in ('open','acknowledged','in_progress','resolved','wont_fix')) default 'open',
  assigned_to     uuid references persons(id),
  reported_by     uuid references persons(id) not null,
  resolution_note text,
  reported_at     timestamptz default now(),
  resolved_at     timestamptz
);
```

Emergency issues trigger immediate notifications to House Manager and exec via trigger. House issues auto-create a derived task.

---

## Part 12: Unified Task Engine

```sql
create table tasks (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid references orgs(id) not null,
  subgroup_id              uuid references subgroups(id),
  task_type                text check (task_type in ('native','house_issue','expense_request','minutes_correction','chore','contract_default','cleanup_failed')) default 'native',
  house_issue_id           uuid references house_issues(id),
  expense_request_id       uuid references expense_requests(id),
  chore_assignment_id      uuid references chore_assignments(id),
  financial_contract_id    uuid references financial_contracts(id),
  event_cleanup_plan_id    uuid references event_cleanup_plans(id),
  title                    text not null,
  description              text,
  priority                 text check (priority in ('low','medium','high','emergency')) default 'medium',
  status                   text check (status in ('open','in_progress','blocked','completed','cancelled')) default 'open',
  created_by               uuid references persons(id) not null,
  assigned_to              uuid references persons(id),
  assigned_to_position_id  uuid references positions(id),
  due_at                   timestamptz,
  is_recurring             boolean default false,
  recurrence_rule          jsonb,
  parent_task_id           uuid references tasks(id),
  event_id                 uuid references events(id),
  eligible_base_statuses   text[],   -- who can see this task
  created_by_type          text check (created_by_type in ('any_member','officer','system')) default 'officer',
  completed_at             timestamptz,
  created_at               timestamptz default now()
);
```

### Derived Task Status Sync (via triggers)

- `house_issues` resolved/wont_fix → task completed
- `expense_requests` reimbursed → task completed
- `chore_assignments` completed → task completed
- `financial_contracts` defaulted → task created for treasurer

---

## Part 13: Communications

### Announcements

```sql
create table announcements (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid references orgs(id) not null,
  subgroup_id            uuid references subgroups(id),
  author_id              uuid references persons(id) not null,
  title                  text not null,
  body                   text not null,
  target_type            text check (target_type in ('all','base_status','individuals','cross_org')),
  target_base_statuses   text[],    -- e.g. ["active","candidate"]
  target_person_ids      uuid[],
  publish_at             timestamptz default now(),
  expires_at             timestamptz,
  pinned                 boolean default false,
  created_at             timestamptz default now()
);

create table announcement_reads (
  announcement_id uuid references announcements(id) not null,
  person_id       uuid references persons(id) not null,
  read_at         timestamptz default now(),
  primary key (announcement_id, person_id)
);
```

### Notifications

```sql
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid references persons(id) not null,
  org_id       uuid references orgs(id),
  type         text not null,
  title        text not null,
  body         text,
  related_id   uuid,
  related_type text,
  read_at      timestamptz,
  created_at   timestamptz default now()
);
```

Notification types: `overspend_warning`, `exec_escalation`, `chore_assigned`, `task_assigned`, `issue_assigned`, `emergency_issue`, `budget_drafting_open`, `election_open`, `platform_submission_visible`, `rollover_ready`, `minutes_circulated`, `minutes_approved`, `announcement`, `contract_pending`, `contract_defaulted`, `cleanup_plan_required`, `cleanup_failed`, `status_changed`, `graduation_confirmed`

---

## Part 14: Rush Management

Available only when `features.rush = true`.

```sql
create table rush_prospects (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid references orgs(id) not null,
  term_id             uuid references terms(id) not null,
  full_name           text not null,
  email               text,
  phone               text,
  school              text,
  bid_status          text check (bid_status in ('prospect','offered','accepted','declined','withdrawn')) default 'prospect',
  converted_person_id uuid references persons(id),
  created_at          timestamptz default now()
);

create table rush_settings (
  id                           uuid primary key default gen_random_uuid(),
  org_id                       uuid references orgs(id) not null,
  term_id                      uuid references terms(id) not null,
  visibility_base_statuses     text[],   -- which base_statuses can view prospects
  voting_open                  boolean default false,
  voting_closes_at             timestamptz,
  vote_pass_threshold          numeric default 0.5,
  vote_pass_type               text check (vote_pass_type in ('majority','supermajority','unanimous')),
  blackball_count              int,
  unique (org_id, term_id)
);
```

### Bid Acceptance Flow

1. `accept_bid()` checks if person record exists for email in fraternity
2. If yes: create `org_affiliation` with candidate base_status only
3. If no: create person + org_affiliation + send invite
4. Rush notes, ratings, attendance stay in rush context — never copied to person record

---

## Part 15: Project Structure

### Folder Layout

```
app/
  (auth)/
    login/page.tsx
    invite/[token]/page.tsx
    reset-password/page.tsx
  (app)/
    layout.tsx                     ← OrgContext, sidebar, org switcher
    [fraternity]/
      home/page.tsx                ← unified home, all orgs summary
      [org]/
        dashboard/page.tsx
        members/page.tsx
        members/[id]/page.tsx
        subgroups/page.tsx
        subgroups/[slug]/page.tsx
        budget/page.tsx
        elections/page.tsx
        events/page.tsx
        rush/page.tsx              ← features.rush only
        house/page.tsx             ← features.house only
        tasks/page.tsx
        announcements/page.tsx
        contracts/page.tsx
        admin/
          page.tsx
          affiliations/page.tsx    ← manage affiliation types + statuses
          positions/page.tsx
          terms/page.tsx
          rollover/page.tsx
  platform/                        ← platform super-admin only

lib/
  supabase/
    client.ts
    server.ts
    types.ts                       ← generated from supabase gen types
  context/
    org-context.tsx
  utils/
    permissions.ts                 ← getEffectivePermissions(affiliation, basePerms, extendedStatus)
    features.ts                    ← isEnabled(org, feature)
    positions.ts                   ← getCurrentRoleHolder(orgId, systemRoleSlug)
    terms.ts                       ← getCurrentTerm(orgId)
    subgroups.ts                   ← isSubgroupHead(), canManageSubgroup()
    minutes.ts                     ← getEffectiveMinutesAuthor(event)
    tasks.ts                       ← getResolvedAssignee(), canActOnTask()
    affiliations.ts                ← getAffiliationStatus(), canTransitionTo()

supabase/
  migrations/
  functions/
    generate-terms/
    rollover-prompt/
    assign-weekly-chores/
    evaluate-election/
    overspend-check/
  seed.sql

middleware.ts
```

### OrgContext

```typescript
type OrgContext = {
  fraternity:     Fraternity
  org:            Org
  affiliation:    OrgAffiliation
  basePerms:      OrgBaseStatusPermissions
  extendedStatus: OrgExtendedStatus | null
  effectivePerms: EffectivePermissions    // computed, use this everywhere
  person:         Person
  allOrgs:        OrgAffiliation[]
  switchOrg:      (orgSlug: string) => void
}

// Always use effectivePerms — never check base_status directly in components
const canVote = effectivePerms.can_vote

// System role lookup — works regardless of position name
const treasurer = await getCurrentRoleHolder(org.id, 'treasurer')
```

### RLS Standard Pattern

```sql
create policy "org isolation"
on [table] for all
using (
  org_id in (
    select oa.org_id
    from org_affiliations oa
    where oa.person_id = auth.uid()
    and   oa.base_status != 'expelled'
    and   (
      select coalesce(oes.can_view_documents, true)
      from org_extended_statuses oes
      where oes.id = oa.extended_status_id
    ) = true
  )
);
```

---

## Part 16: Build Order

| Weeks | Focus | Deliverable |
|-------|-------|------------|
| 1–2 | Platform setup | Schema with terms, org_affiliations, base/extended statuses, system_position_roles, national_org_templates; RLS; seed data; TypeScript types |
| 3–4 | Auth + org routing | Login, OrgContext with effectivePerms, org switcher, middleware |
| 5–6 | National org setup | Org creation wizard — pick national org, review seeded positions, base status permissions, extended statuses |
| 7–8 | Person profiles | Shared registry, org_affiliations, roster filtered by base_status |
| 9–10 | Invite flow | Invite with base_status assignment, onboarding, existing-person detection |
| 11–12 | Status management | Status change workflows, graduation flow, suspension workflows, audit trail |
| 13–14 | Subgroups | Subgroup CRUD, auto-population triggers, committee mini-dashboards |
| 15–16 | Budget module | Proposals, line items, expenses, overspend escalation |
| 17–18 | Financial contracts | Contract creation, digital signature, payment plans |
| 19–20 | Elections | Full election system, platform submissions, officer seeding |
| 21–22 | Term rollover | Rollover wizard, graduation suggestions, budget kickoff |
| 23–24 | Task engine | Derived + native tasks, position assignment, recurrence |
| 25–26 | Events + minutes | Calendar, attendance, minutes workflow, cleanup plans |
| 27–28 | Announcements | Feed, status-based targeting, scheduling, read receipts |
| 29–30 | Rush | Prospect tracking, voting, bid acceptance |
| 31–32 | House management | Rooms, chores, issue reporting, cleanup plan workflow |
| 33+ | Daily ops & platform | Unified home, exec dashboard, documents, national org editor |

---

## Part 17: Roadmap

| Phase | Feature Area | Key Deliverables |
|-------|-------------|-----------------|
| Phase 1 | Multi-tenant foundation | Fraternities, orgs, persons, affiliations, feature flags, RLS, auth, org switcher |
| Phase 1 | Terms & affiliation model | Term definitions + auto-gen, base/extended statuses, system position roles |
| Phase 1 | National org registry | Sigma Nu template seeded; org creation wizard |
| Phase 2 | Subgroups | Committees, exec board, pledge cohorts, house residents |
| Phase 2 | Finance | Budget proposals, expenses, overspend escalation, financial contracts |
| Phase 2 | Governance | Elections, platform submissions, ballot secrecy, officer seeding, rollover |
| Phase 3 | Task engine | Derived + native tasks, position assignment, recurrence |
| Phase 3 | Events + minutes | Calendar, attendance, minutes workflow, cleanup plans |
| Phase 3 | Announcements | Feed, status-based targeting, scheduling, read receipts |
| Phase 3 | Rush | Prospect tracking, voting, bid acceptance |
| Phase 3 | House management | Rooms, chores, issue reporting, cleanup plan workflow |
| Phase 4 | Daily ops | Unified home, exec dashboard, documents, dues invoicing |
| Phase 4 | Platform | Fraternity onboarding, billing, national org template editor |
| Future | QuickBooks | OAuth, webhooks, person/vendor mapping, reimbursement sync |

---

## Key Rules for Development

1. **Always use `term_id`** — never `semester + year`
2. **Always use `affiliation_type` + `base_status` + `extended_status_id`** — never hardcoded role strings
3. **Always use `effectivePerms`** from OrgContext — never check base_status directly in components
4. **Always use system role slug** for position lookups — never position title
5. **Person records are never deleted** — only access is removed via status changes
6. **Expelled = always zero access** — hardcoded, no exceptions, no configuration
7. **Run `supabase db push`** after any schema changes
8. **Run `supabase gen types typescript`** after schema changes
9. **Check feature flags** before rendering any feature — `isEnabled(org, 'budget')`
10. **RLS lives at the database level** — never rely on UI-only permission checks
11. **Status changes always write to `affiliation_status_history`** — never update status silently
12. **Graduation is always admin-confirmed** — system suggests, admin approves