-- Phase 1 Core Schema
-- Extends 20260331033416 which created: fraternities, platform_admins, orgs
--
-- Strategy: create ALL tables first, then enable RLS and add policies at the
-- end to avoid forward-reference issues (most policies reference org_memberships).

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

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

insert into system_position_roles (slug, default_name, is_presiding_officer, is_required) values
  ('presiding_officer', 'President', true, true);
insert into system_position_roles (slug, default_name, is_vice_president, is_required) values
  ('vice_president', 'Vice President', true, true);
insert into system_position_roles (slug, default_name, is_treasurer, is_required) values
  ('treasurer', 'Treasurer', true, true);
insert into system_position_roles (slug, default_name, is_secretary, is_required) values
  ('secretary', 'Secretary', true, true);
insert into system_position_roles (slug, default_name, is_house_manager) values
  ('house_manager', 'House Manager', true);
insert into system_position_roles (slug, default_name, is_rush_chair) values
  ('rush_chair', 'Rush Chair', true);

create table national_organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  abbreviation text,
  org_type     text not null,
  founded_year int,
  website      text,
  logo_url     text,
  status       text check (status in ('active', 'pending', 'inactive')) default 'active',
  submitted_by uuid,
  approved_by  uuid
);

create table national_org_templates (
  id               uuid primary key default gen_random_uuid(),
  national_org_id  uuid references national_organizations(id) not null,
  chapter_type     text not null,
  display_name     text not null,
  default_features jsonb not null default '{}',
  term_structure   text,
  is_default       boolean default false
);

create table term_definitions (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id) not null,
  name                  text not null,
  slug                  text not null,
  ordinal               int not null,
  start_month           int not null,
  start_day             int not null,
  end_month             int not null,
  end_day               int not null,
  has_elections         boolean default true,
  has_budget            boolean default true,
  has_rollover          boolean default true,
  has_rush              boolean default false,
  officer_selection     text check (officer_selection in ('elected', 'appointed', 'carried_over')) default 'elected',
  auto_generate         boolean default true,
  generate_months_ahead int default 2,
  is_active             boolean default true,
  unique (org_id, slug)
);

create table terms (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid references orgs(id) not null,
  definition_id     uuid references term_definitions(id) not null,
  name              text not null,
  year              int not null,
  starts_on         date not null,
  ends_on           date not null,
  status            text check (status in ('upcoming', 'active', 'completed')) default 'upcoming',
  has_elections     boolean not null,
  has_budget        boolean not null,
  has_rollover      boolean not null,
  has_rush          boolean not null,
  officer_selection text not null,
  unique (org_id, definition_id, year)
);

create table pledge_classes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references orgs(id) not null,
  name            text not null,
  term_id         uuid references terms(id),
  initiated_count int default 0
);

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
  big_id                 uuid references persons(id),
  initiation_date        date,
  member_number          text,
  expected_grad_year     int,
  major                  text,
  quickbooks_customer_id text,
  quickbooks_vendor_id   text,
  created_at             timestamptz default now()
);

-- Deferred FKs for national_organizations
alter table national_organizations
  add constraint national_organizations_submitted_by_fkey
  foreign key (submitted_by) references persons(id);
alter table national_organizations
  add constraint national_organizations_approved_by_fkey
  foreign key (approved_by) references persons(id);

create table membership_types (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id) not null,
  name                  text not null,
  slug                  text not null,
  description           text,
  is_default            boolean default false,
  access_level          text check (access_level in ('full', 'limited', 'read_only', 'none')) not null,
  can_vote              boolean default false,
  can_hold_office       boolean default false,
  can_attend_events     boolean default true,
  can_view_roster       boolean default true,
  can_view_financials   boolean default false,
  can_submit_expenses   boolean default false,
  can_view_minutes      boolean default true,
  can_speak_at_meetings boolean default true,
  can_view_documents    boolean default true,
  color                 text,
  is_locked             boolean default false,
  can_rename            boolean default true,
  display_order         int,
  unique (org_id, slug)
);

create table org_memberships (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid references persons(id) not null,
  org_id             uuid references orgs(id) not null,
  membership_type_id uuid references membership_types(id) not null,
  status             text check (status in ('active', 'probated', 'suspended', 'expelled', 'away', 'inactive')) default 'active',
  chapter_email      text,
  position_id        uuid,
  joined_at          date,
  notes              text,
  unique (person_id, org_id)
);

create table positions (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid references orgs(id) not null,
  title                text not null,
  slug                 text not null,
  system_role_id       uuid references system_position_roles(id),
  type                 text check (type in ('exec', 'committee', 'house', 'board', 'other')),
  permission_level     text check (permission_level in ('exec', 'officer')),
  max_holders          int default 1,
  has_budget           boolean default false,
  is_presiding_officer boolean default false,
  semester_scope       text[],
  officer_selection    text check (officer_selection in ('elected', 'appointed', 'carried_over')),
  is_locked            boolean default false,
  can_rename           boolean default true,
  display_order        int,
  unique (org_id, slug)
);

-- Deferred FK: org_memberships.position_id → positions
alter table org_memberships
  add constraint org_memberships_position_id_fkey
  foreign key (position_id) references positions(id);

create table position_assignments (
  id          uuid primary key default gen_random_uuid(),
  position_id uuid references positions(id) not null,
  person_id   uuid references persons(id) not null,
  org_id      uuid references orgs(id) not null,
  term_id     uuid references terms(id) not null,
  term_start  date,
  term_end    date,
  is_acting   boolean default false,
  assigned_by uuid references persons(id)
);

create table subgroups (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references orgs(id) not null,
  name             text not null,
  slug             text not null,
  subgroup_type    text check (subgroup_type in ('committee', 'exec_board', 'pledge_class', 'house_residents', 'ad_hoc')),
  membership_type  text check (membership_type in ('appointed', 'elected', 'open', 'invite_only', 'automatic')),
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
  role         text check (role in ('head', 'member')) default 'member',
  join_type    text check (join_type in ('appointed', 'elected', 'self_joined', 'invited', 'automatic')),
  appointed_by uuid references persons(id),
  joined_at    date default current_date,
  left_at      date,
  unique (subgroup_id, person_id)
);

create table event_categories (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid references orgs(id),
  name   text not null,
  color  text,
  icon   text
);

-- ============================================================================
-- 2. VIEW
-- ============================================================================

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

-- ============================================================================
-- 3. ENABLE RLS ON ALL TABLES
-- ============================================================================

alter table system_position_roles enable row level security;
alter table national_organizations enable row level security;
alter table national_org_templates enable row level security;
alter table term_definitions       enable row level security;
alter table terms                  enable row level security;
alter table pledge_classes         enable row level security;
alter table persons                enable row level security;
alter table membership_types       enable row level security;
alter table org_memberships        enable row level security;
alter table positions              enable row level security;
alter table position_assignments   enable row level security;
alter table subgroups              enable row level security;
alter table subgroup_members       enable row level security;
alter table event_categories       enable row level security;

-- ============================================================================
-- 4. RLS POLICIES
-- All tables exist now, so org_memberships references are safe.
-- ============================================================================

-- Helper pattern used everywhere:
--   org_id in (select org_id from org_memberships where person_id = auth.uid() and status != 'expelled')

-- Reference data: any authenticated user
create policy "system_position_roles_select" on system_position_roles for select using (auth.uid() is not null);
create policy "national_organizations_select" on national_organizations for select using (auth.uid() is not null);
create policy "national_org_templates_select" on national_org_templates for select using (auth.uid() is not null);

-- Existing tables: add member-read policies (admin policies from prior migration still apply)
create policy "fraternities_member_select"
on fraternities for select
using (
  id in (
    select f.id from fraternities f
    join orgs o on o.fraternity_id = f.id
    join org_memberships om on om.org_id = o.id
    where om.person_id = (select auth.uid()) and om.status != 'expelled'
  )
);

create policy "orgs_member_select"
on orgs for select
using (
  id in (
    select org_id from org_memberships
    where person_id = (select auth.uid()) and status != 'expelled'
  )
);

-- Org-scoped tables: standard pattern
create policy "term_definitions_select" on term_definitions for select
using (org_id in (select org_id from org_memberships where person_id = (select auth.uid()) and status != 'expelled'));

create policy "terms_select" on terms for select
using (org_id in (select org_id from org_memberships where person_id = (select auth.uid()) and status != 'expelled'));

create policy "pledge_classes_select" on pledge_classes for select
using (org_id in (select org_id from org_memberships where person_id = (select auth.uid()) and status != 'expelled'));

create policy "membership_types_select" on membership_types for select
using (org_id in (select org_id from org_memberships where person_id = (select auth.uid()) and status != 'expelled'));

create policy "org_memberships_select" on org_memberships for select
using (org_id in (select org_id from org_memberships where person_id = (select auth.uid()) and status != 'expelled'));

create policy "positions_select" on positions for select
using (org_id in (select org_id from org_memberships where person_id = (select auth.uid()) and status != 'expelled'));

create policy "position_assignments_select" on position_assignments for select
using (org_id in (select org_id from org_memberships where person_id = (select auth.uid()) and status != 'expelled'));

create policy "subgroups_select" on subgroups for select
using (org_id in (select org_id from org_memberships where person_id = (select auth.uid()) and status != 'expelled'));

create policy "subgroup_members_select" on subgroup_members for select
using (subgroup_id in (
  select s.id from subgroups s
  join org_memberships om on om.org_id = s.org_id
  where om.person_id = (select auth.uid()) and om.status != 'expelled'
));

create policy "event_categories_select" on event_categories for select
using (
  org_id is null
  or org_id in (select org_id from org_memberships where person_id = (select auth.uid()) and status != 'expelled')
);

-- Persons: fraternity-scoped read, self-update, any-auth insert
create policy "persons_select" on persons for select
using (
  fraternity_id in (
    select f.id from fraternities f
    join orgs o on o.fraternity_id = f.id
    join org_memberships om on om.org_id = o.id
    where om.person_id = (select auth.uid()) and om.status != 'expelled'
  )
);

create policy "persons_update" on persons for update
using (id = (select auth.uid()));

create policy "persons_insert" on persons for insert
with check (
  exists (select 1 from platform_admins where id = (select auth.uid()))
  or id = (select auth.uid())
);
