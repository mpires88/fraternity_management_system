-- ============================================================================
-- ARCHITECTURE V2: Simplify to 2-level model
--
-- Before: parent_organizations → fraternities → orgs
-- After:  parent_organizations → organizations
--
-- Key changes:
--   1. national_organizations → parent_organizations (add slug)
--   2. orgs gains parent_organization_id, logo_url, terminology
--   3. orgs renamed → organizations
--   4. fraternities table dropped (absorbed into organizations)
--   5. persons.fraternity_id dropped (platform-level persons)
--   6. house → facilities
--   7. org_relationships gains proposal/status fields
--   8. RLS helpers updated
--   9. advisory_board added to subgroup types
-- ============================================================================

-- ── 1. Rename national_organizations → parent_organizations ─────────────────

alter table national_organizations rename to parent_organizations;
alter table parent_organizations add column if not exists slug text;

-- Generate slugs from name
update parent_organizations
set slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'))
where slug is null;

alter table parent_organizations alter column slug set not null;
create unique index if not exists parent_organizations_slug_idx on parent_organizations(slug);

-- Rename FKs on national_org_templates
alter table national_org_templates rename column national_org_id to parent_organization_id;

-- ── 2. Add new columns to orgs ──────────────────────────────────────────────

alter table orgs add column if not exists parent_organization_id uuid references parent_organizations(id);
alter table orgs add column if not exists logo_url text;
alter table orgs add column if not exists terminology jsonb default '{}';

-- Make slug globally unique (drop old fraternity-scoped unique)
alter table orgs drop constraint if exists orgs_fraternity_id_slug_key;

-- ── 3. Migrate data: link orgs to parent_organizations ──────────────────────

-- For each org, look up its fraternity → find matching parent_org by name pattern
-- Sigma Nu fraternity → Sigma Nu parent org
update orgs o
set parent_organization_id = po.id
from fraternities f, parent_organizations po
where o.fraternity_id = f.id
  and po.name ilike '%' || split_part(f.name, ' ', 1) || ' ' || split_part(f.name, ' ', 2) || '%';

-- Copy logo_url from fraternities
update orgs o
set logo_url = f.logo_url
from fraternities f
where o.fraternity_id = f.id and f.logo_url is not null;

-- ── 4. Rename orgs → organizations ──────────────────────────────────────────

alter table orgs rename to organizations;

-- Update slug for epsilon theta chapter
update organizations set slug = 'epsilon-theta' where slug = 'undergrad';

-- Make slug globally unique
create unique index if not exists organizations_slug_idx on organizations(slug);

-- ── 5. Drop fraternity_id from organizations ────────────────────────────────

alter table organizations drop constraint if exists orgs_fraternity_id_fkey;
alter table organizations drop column if exists fraternity_id;

-- ── 6. Drop fraternity_id from persons (platform-level) ─────────────────────

-- Must drop dependent policies first
drop policy if exists "persons_select" on persons;
drop policy if exists "persons_insert" on persons;

alter table persons drop constraint if exists persons_fraternity_id_fkey;
alter table persons drop column if exists fraternity_id;

-- ── 7. Rename house → facilities ────────────────────────────────────────────

alter table house rename to facilities;
alter table facilities rename column fraternity_id to organization_id;
-- Update FK to point to organizations instead of fraternities
alter table facilities drop constraint if exists house_fraternity_id_fkey;
-- We'll set this FK after we know the org IDs

-- For rooms, rename house_id → facility_id
alter table rooms rename column house_id to facility_id;
alter table rooms drop constraint if exists rooms_house_id_fkey;
alter table rooms add constraint rooms_facility_id_fkey foreign key (facility_id) references facilities(id);

-- Change floor from int to text to support "Basement", "Mezzanine", etc.
alter table rooms alter column floor type text using floor::text;

-- ── 8. Update org_relationships ─────────────────────────────────────────────

-- Rename org_id references (the table already uses parent_org_id/child_org_id)
-- Add proposal/confirmation fields
alter table org_relationships add column if not exists status text
  check (status in ('pending', 'active', 'rejected')) default 'active';
alter table org_relationships add column if not exists proposed_by_org_id uuid references organizations(id);
alter table org_relationships add column if not exists proposed_by_person_id uuid references persons(id);
alter table org_relationships add column if not exists confirmed_by_person_id uuid references persons(id);
alter table org_relationships add column if not exists confirmed_at timestamptz;

-- Update existing relationships to active
update org_relationships set status = 'active' where status is null;

-- ── 9. Update subgroup types ────────────────────────────────────────────────

alter table subgroups drop constraint if exists subgroups_subgroup_type_check;
alter table subgroups add constraint subgroups_subgroup_type_check
  check (subgroup_type in ('committee', 'exec_board', 'pledge_class', 'house_residents', 'ad_hoc', 'family_line', 'advisory_board'));

-- ── 10. Update org_memberships FK ───────────────────────────────────────────

-- org_memberships.org_id already points to the right table (orgs → organizations via rename)
-- Just need to rename the constraint
alter table org_memberships drop constraint if exists org_memberships_org_id_fkey;
alter table org_memberships add constraint org_memberships_organization_id_fkey
  foreign key (org_id) references organizations(id);

-- ── 11. Update facilities to reference organizations ────────────────────────

-- Find the correct organization for each facility
-- Currently facilities have fraternity_id (now organization_id) pointing to old fraternities
-- We need to point to the actual organization
update facilities f
set organization_id = (
  select o.id from organizations o
  where o.id = f.managed_by_org_id
)
where f.managed_by_org_id is not null;

alter table facilities drop constraint if exists house_managed_by_org_id_fkey;
alter table facilities add constraint facilities_managed_by_org_id_fkey
  foreign key (managed_by_org_id) references organizations(id);

alter table facilities add constraint facilities_organization_id_fkey
  foreign key (organization_id) references organizations(id);

-- ── 12. Update other FKs pointing to fraternities ───────────────────────────

-- pledge_classes.org_id already points to orgs (now organizations)
-- positions.org_id already points to orgs (now organizations)
-- subgroups.org_id already points to orgs (now organizations)
-- term_definitions.org_id already points to orgs (now organizations)
-- terms.org_id already points to orgs (now organizations)
-- All good - the rename handles these automatically.

-- ── 13. Drop fraternities table ─────────────────────────────────────────────

-- Drop RLS policies first
drop policy if exists "platform admins can do everything on fraternities" on fraternities;
drop policy if exists "fraternities_member_select" on fraternities;

drop table if exists fraternities;

-- ── 14. Update RLS helper functions ─────────────────────────────────────────

-- Drop ALL policies that depend on get_my_fraternity_ids before dropping it
drop policy if exists "house_select" on facilities;
drop policy if exists "rooms_select" on rooms;
drop policy if exists "room_assignments_select" on room_assignments;
drop policy if exists "room_assignments_insert" on room_assignments;

drop function if exists get_my_fraternity_ids();

create or replace function get_my_organization_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select om.org_id from org_memberships om
  join status_definitions sd on sd.id = om.status_id
  where om.person_id = auth.uid()
    and sd.slug != 'expelled'
    and om.ended_at is null
$$;

-- get_my_org_ids now includes ended_at check
create or replace function get_my_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select om.org_id from org_memberships om
  join status_definitions sd on sd.id = om.status_id
  where om.person_id = auth.uid()
    and sd.slug != 'expelled'
    and om.ended_at is null
$$;

-- ── 15. Update RLS policies ─────────────────────────────────────────────────

-- Organizations: members can see their own orgs, platform admins see all
drop policy if exists "orgs_member_select" on organizations;
drop policy if exists "platform admins can do everything on orgs" on organizations;

create policy "organizations_select" on organizations for select
using (
  id in (select get_my_org_ids())
  or exists (select 1 from platform_admins where id = (select auth.uid()))
);

create policy "organizations_admin_all" on organizations for all
using (exists (select 1 from platform_admins where id = (select auth.uid())));

-- Persons: can see people in your organizations (platform-level)
drop policy if exists "persons_select" on persons;
create policy "persons_select" on persons for select
using (
  id in (
    select om2.person_id from org_memberships om1
    join org_memberships om2 on om2.org_id = om1.org_id
    where om1.person_id = (select auth.uid())
    and om1.ended_at is null
  )
  or id = (select auth.uid())
);

-- Facilities
drop policy if exists "house_select" on facilities;
create policy "facilities_select" on facilities for select
using (organization_id in (select get_my_org_ids()));

-- Rooms
drop policy if exists "rooms_select" on rooms;
create policy "rooms_select" on rooms for select
using (facility_id in (
  select id from facilities where organization_id in (select get_my_org_ids())
));

-- Room assignments
drop policy if exists "room_assignments_select" on room_assignments;
create policy "room_assignments_select" on room_assignments for select
using (room_id in (
  select r.id from rooms r
  join facilities f on f.id = r.facility_id
  where f.organization_id in (select get_my_org_ids())
));

-- Parent organizations: visible to all authenticated users
drop policy if exists "national_organizations_select" on parent_organizations;
create policy "parent_organizations_select" on parent_organizations for select
using (auth.uid() is not null);

-- Update national_org_templates policy
drop policy if exists "national_org_templates_select" on national_org_templates;
create policy "parent_org_templates_select" on national_org_templates for select
using (auth.uid() is not null);
