-- ============================================================================
-- CHAPTER MANAGEMENT PLATFORM — COMPLETE SCHEMA REFERENCE
-- ============================================================================
-- This file is NOT a migration. It documents the full current schema
-- in logical dependency order for developer reference.
--
-- Generated from migrations:
--   20260331031605_initial_schema.sql (superseded)
--   20260331033416_initial_schema.sql
--   20260402000000_phase1_schema.sql
--   20260402000001_seed_sigma_nu.sql
--   20260402000002_fix_rls_recursion.sql
--   20260402000003_member_management_rls.sql
--   20260402000004_person_name_columns.sql
--   20260402000005_address_emergency_fields.sql
--   20260402000006_person_contacts.sql
--   20260403000000_fix_deviations.sql
--   20260403000001_rooms_extended.sql
--
-- Migration naming convention (follow for all new migrations):
--   YYYYMMDD_NNNNNN_descriptive_name.sql
--   Examples:
--     20260405000001_add_budget_tables.sql
--     20260405000002_election_win_conditions.sql
--     20260405000003_fix_position_rls.sql
-- ============================================================================


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ TIER 1: PLATFORM FOUNDATION                                            │
-- │ No dependencies on other app tables.                                    │
-- └──────────────────────────────────────────────────────────────────────────┘

-- Platform super-admins (you)
create table platform_admins (
  id                    uuid references auth.users primary key,
  email                 text not null,
  created_at            timestamptz default now()
);

-- Top-level tenants
create table fraternities (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text unique not null,
  logo_url              text,
  created_at            timestamptz default now()
);

-- System-wide position role identifiers (seed data)
-- "Commander" and "President" both map to presiding_officer
create table system_position_roles (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null,
  default_name          text not null,
  description           text,
  is_presiding_officer  boolean default false,
  is_treasurer          boolean default false,
  is_secretary          boolean default false,
  is_vice_president     boolean default false,
  is_house_manager      boolean default false,
  is_rush_chair         boolean default false,
  is_required           boolean default false
);

-- National org registry (reference data)
create table national_organizations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  abbreviation          text,
  org_type              text not null,
  founded_year          int,
  website               text,
  logo_url              text,
  status                text check (status in ('active', 'pending', 'inactive')) default 'active',
  submitted_by          uuid references persons(id),  -- deferred FK
  approved_by           uuid references persons(id)   -- deferred FK
);

create table national_org_templates (
  id                    uuid primary key default gen_random_uuid(),
  national_org_id       uuid references national_organizations(id) not null,
  chapter_type          text not null,       -- 'undergraduate', 'alumni', 'housing_corp'
  display_name          text not null,
  default_features      jsonb not null default '{}',
  term_structure        text,                -- 'semester', 'quarter', 'annual'
  is_default            boolean default false
);


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ TIER 2: ORG STRUCTURE                                                   │
-- │ Depends on: fraternities                                                │
-- └──────────────────────────────────────────────────────────────────────────┘

-- Orgs within a fraternity (chapter, housing corp, alumni chapter, etc.)
create table orgs (
  id                    uuid primary key default gen_random_uuid(),
  fraternity_id         uuid references fraternities(id) not null,
  name                  text not null,
  slug                  text not null,
  org_type              text not null,       -- 'chapter', 'housing_corp', 'alumni_chapter', 'advisory_board', 'other'
  features              jsonb default '{}',  -- feature flags: { members, budget, elections, ... }
  settings              jsonb default '{}',
  created_at            timestamptz default now(),
  unique (fraternity_id, slug)
);

-- Term structure: each org defines its own terms
create table term_definitions (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id) not null,
  name                  text not null,       -- 'Fall', 'Spring', 'Q1', 'Fiscal Year'
  slug                  text not null,
  ordinal               int not null,        -- display order within a year
  start_month           int not null,
  start_day             int not null,
  end_month             int not null,
  end_day               int not null,
  has_elections          boolean default true,
  has_budget             boolean default true,
  has_rollover           boolean default true,
  has_rush               boolean default false,
  officer_selection      text check (officer_selection in ('elected', 'appointed', 'carried_over')) default 'elected',
  auto_generate          boolean default true,
  generate_months_ahead  int default 2,
  is_active              boolean default true,
  unique (org_id, slug)
);

-- Instantiated terms (one per definition per year)
create table terms (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id) not null,
  definition_id         uuid references term_definitions(id) not null,
  name                  text not null,       -- 'Fall 2025', 'Spring 2026'
  year                  int not null,
  starts_on             date not null,
  ends_on               date not null,
  status                text check (status in ('upcoming', 'active', 'completed')) default 'upcoming',
  -- snapshot of definition settings at generation time
  has_elections          boolean not null,
  has_budget             boolean not null,
  has_rollover           boolean not null,
  has_rush               boolean not null,
  officer_selection      text not null,
  unique (org_id, definition_id, year)
);

-- Pledge classes
create table pledge_classes (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id) not null,
  name                  text not null,
  term_id               uuid references terms(id),
  initiated_count       int default 0
);

-- Event categories
create table event_categories (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id),   -- null = platform default
  name                  text not null,
  color                 text,
  icon                  text
);


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ TIER 3: PEOPLE & MEMBERSHIP                                            │
-- │ Depends on: fraternities, orgs, pledge_classes                          │
-- └──────────────────────────────────────────────────────────────────────────┘

-- One person record per auth user per fraternity
create table persons (
  id                    uuid references auth.users primary key,
  fraternity_id         uuid references fraternities(id) not null,
  -- Name
  full_name             text not null,
  first_name            text,
  middle_name           text,
  last_name             text,
  preferred_name        text,
  nickname              text,                -- brother nickname
  -- Contact
  email                 text not null,
  phone                 text,
  personal_email        text,
  -- Address
  street_address        text,
  city                  text,
  state                 text,
  country               text,
  address               text,                -- legacy combined field
  -- Emergency (legacy text fields — see person_contacts for structured data)
  emergency_contact     text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  -- Profile
  profile_photo         text,
  bio                   text,
  date_of_birth         date,
  -- Chapter
  pledge_class_id       uuid references pledge_classes(id),
  pledge_class_name     text,
  big_id                uuid references persons(id),  -- big brother (self-ref)
  family_line           text,
  initiation_date       date,
  bid_date              date,
  member_number         text,                -- badge/alpha number
  expected_grad_year    int,
  major                 text,
  -- Integrations
  quickbooks_customer_id text,
  quickbooks_vendor_id  text,
  -- Meta
  created_at            timestamptz default now()
);

-- Configurable membership types per org
create table membership_types (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id) not null,
  name                  text not null,       -- 'Active Brother', 'Candidate', 'Alumni'
  slug                  text not null,
  description           text,
  is_default            boolean default false,
  access_level          text check (access_level in ('full', 'limited', 'read_only', 'none')) not null,
  -- Toggleable permissions
  can_vote              boolean default false,
  can_hold_office       boolean default false,
  can_attend_events     boolean default true,
  can_view_roster       boolean default true,
  can_view_financials   boolean default false,
  can_submit_expenses   boolean default false,
  can_view_minutes      boolean default true,
  can_speak_at_meetings boolean default true,
  can_view_documents    boolean default true,
  -- Display
  color                 text,
  is_locked             boolean default false,
  can_rename            boolean default true,
  display_order         int,
  unique (org_id, slug)
);

-- A person's membership in an org
create table org_memberships (
  id                    uuid primary key default gen_random_uuid(),
  person_id             uuid references persons(id) not null,
  org_id                uuid references orgs(id) not null,
  membership_type_id    uuid references membership_types(id) not null,
  status                text check (status in ('active', 'probated', 'suspended', 'expelled', 'away', 'inactive')) default 'active',
  chapter_email         text,
  position_id           uuid references positions(id),  -- deferred FK
  joined_at             date,
  notes                 text,
  unique (person_id, org_id)
);

-- Emergency/family contacts as real persons
create table person_contacts (
  id                    uuid primary key default gen_random_uuid(),
  person_id             uuid references persons(id) not null,
  contact_person_id     uuid references persons(id) not null,
  relationship          text not null check (relationship in ('parent', 'guardian', 'spouse', 'partner', 'sibling', 'other')),
  is_emergency          boolean default true,
  is_primary            boolean default false,
  notes                 text,
  created_at            timestamptz default now(),
  unique (person_id, contact_person_id)
);


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ TIER 4: POSITIONS & ASSIGNMENTS                                         │
-- │ Depends on: orgs, persons, terms, system_position_roles                 │
-- └──────────────────────────────────────────────────────────────────────────┘

-- Officer/committee positions within an org
create table positions (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id) not null,
  title                 text not null,       -- 'Commander', 'Treasurer'
  slug                  text not null,
  system_role_id        uuid references system_position_roles(id),  -- null for custom positions
  type                  text check (type in ('exec', 'committee', 'house', 'board', 'other')),
  permission_level      text check (permission_level in ('exec', 'officer')),
  max_holders           int default 1,
  has_budget            boolean default false,
  is_presiding_officer  boolean default false,
  semester_scope        text[],              -- which term slugs this position exists in
  officer_selection     text check (officer_selection in ('elected', 'appointed', 'carried_over')),
  is_locked             boolean default false,
  can_rename            boolean default true,
  display_order         int,
  unique (org_id, slug)
);

-- Who holds which position in which term
create table position_assignments (
  id                    uuid primary key default gen_random_uuid(),
  position_id           uuid references positions(id) not null,
  person_id             uuid references persons(id) not null,
  org_id                uuid references orgs(id) not null,
  term_id               uuid references terms(id) not null,
  term_start            date,
  term_end              date,       -- null = currently active
  is_acting             boolean default false,
  assigned_by           uuid references persons(id)
);


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ TIER 5: SUBGROUPS                                                       │
-- │ Depends on: orgs, persons, positions, pledge_classes                    │
-- └──────────────────────────────────────────────────────────────────────────┘

-- Named member subsets (committees, exec board, pledge classes, etc.)
create table subgroups (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id) not null,
  name                  text not null,
  slug                  text not null,
  subgroup_type         text check (subgroup_type in ('committee', 'exec_board', 'pledge_class', 'house_residents', 'ad_hoc')),
  membership_type       text check (membership_type in ('appointed', 'elected', 'open', 'invite_only', 'automatic')),
  head_position_id      uuid references positions(id),
  pledge_class_id       uuid references pledge_classes(id),
  is_private            boolean default false,
  is_locked             boolean default false,
  can_rename            boolean default true,
  unique (org_id, slug)
);

create table subgroup_members (
  id                    uuid primary key default gen_random_uuid(),
  subgroup_id           uuid references subgroups(id) not null,
  person_id             uuid references persons(id) not null,
  role                  text check (role in ('head', 'member')) default 'member',
  join_type             text check (join_type in ('appointed', 'elected', 'self_joined', 'invited', 'automatic')),
  appointed_by          uuid references persons(id),
  joined_at             date default current_date,
  left_at               date,
  unique (subgroup_id, person_id)
);


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ TIER 6: HOUSE MANAGEMENT                                                │
-- │ Depends on: fraternities, orgs, persons, terms                          │
-- └──────────────────────────────────────────────────────────────────────────┘

-- Physical houses (fraternity level, shared across orgs)
create table house (
  id                    uuid primary key default gen_random_uuid(),
  fraternity_id         uuid references fraternities(id) not null,
  name                  text not null,       -- 'SPE', 'LCA'
  address               text,
  managed_by_org_id     uuid references orgs(id)
);

-- Individual rooms with furniture inventory
create table rooms (
  id                    uuid primary key default gen_random_uuid(),
  house_id              uuid references house(id) not null,
  name                  text not null,
  type                  text check (type in ('single', 'double', 'common', 'bathroom', 'storage', 'study', 'lounge', 'service', 'other')),
  floor                 int,
  capacity              int default 1,
  is_active             boolean default true,
  display_order         int,
  -- Extended details
  nickname              text,                -- 'La Pinta', 'Barn', 'Shaft'
  room_number           text,
  square_footage        int,
  floor_plan_code       text,
  floor_plan_use        text,
  description           text,
  -- Furniture inventory
  beds                  int default 0,
  mattresses            int default 0,
  dressers              int default 0,
  desks                 int default 0,
  desk_chairs           int default 0,
  book_shelves          int default 0,
  closets               int default 0,
  sofas                 int default 0,
  loft_kits             int default 0,
  ideal_capacity        int
);

-- Who lives in which room each term
create table room_assignments (
  id                    uuid primary key default gen_random_uuid(),
  room_id               uuid references rooms(id) not null,
  member_id             uuid references persons(id) not null,
  term_id               uuid references terms(id) not null,
  starts_on             date not null,
  ends_on               date,
  notes                 text,
  unique (room_id, member_id, term_id)
);


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ VIEWS                                                                    │
-- └──────────────────────────────────────────────────────────────────────────┘

create view current_system_role_holders as
select
  pa.org_id,
  spr.slug        as system_role,
  pa.person_id,
  p.full_name,
  pos.title       as position_title
from position_assignments pa
join positions pos on pos.id = pa.position_id
join system_position_roles spr on spr.id = pos.system_role_id
join persons p on p.id = pa.person_id
where pa.term_end is null;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ RLS HELPER FUNCTIONS                                                     │
-- └──────────────────────────────────────────────────────────────────────────┘

-- Returns org IDs the current user belongs to (bypasses RLS to avoid recursion)
create function get_my_org_ids() returns setof uuid
  language sql security definer set search_path = public stable
as $$ select org_id from org_memberships where person_id = auth.uid() and status != 'expelled' $$;

-- Returns fraternity IDs the current user belongs to
create function get_my_fraternity_ids() returns setof uuid
  language sql security definer set search_path = public stable
as $$
  select distinct f.id from fraternities f
  join orgs o on o.fraternity_id = f.id
  join org_memberships om on om.org_id = o.id
  where om.person_id = auth.uid() and om.status != 'expelled'
$$;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ TABLES NOT YET CREATED (from spec, coming in future migrations)         │
-- │                                                                          │
-- │ Phase 2: budgets, budget_proposals, budget_line_items, expense_requests, │
-- │          financial_contracts, contract_payments, elections,               │
-- │          election_win_conditions, election_positions,                     │
-- │          election_nominations, election_ballots, election_tallies        │
-- │                                                                          │
-- │ Phase 3: events, minutes_corrections, event_cleanup_plans,              │
-- │          tasks, task_activity, task_attachments,                          │
-- │          announcements, announcement_reads, notifications,               │
-- │          rush_prospects, rush_settings, rush_attendance,                 │
-- │          prospect_ratings, prospect_notes,                               │
-- │          chores, chore_assignments, house_issues                         │
-- └──────────────────────────────────────────────────────────────────────────┘
