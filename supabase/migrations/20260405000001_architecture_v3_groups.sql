-- ============================================================================
-- ARCHITECTURE V3: Add groups layer
--
-- Before: parent_organizations → organizations (flat)
-- After:  parent_organizations → organizations → groups
--
-- URL: /[parent]/[org]/[group]/[feature]
-- Example: /sigma-nu/epsilon-theta/chapter/dashboard
-- ============================================================================

-- ── 1. Create groups table ──────────────────────────────────────────────────

create table groups (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,  -- FK added after organizations is restructured
  name                text not null,
  slug                text not null,
  group_type          text,           -- 'chapter', 'housing_corp', 'advisory_board', 'alumni', 'other'
  features            jsonb default '{}',
  settings            jsonb default '{}',
  terminology         jsonb default '{}',
  is_primary          boolean default false,  -- the main group (e.g. chapter)
  logo_url            text,
  created_at          timestamptz default now(),
  unique (organization_id, slug)
);

-- ── 2. Create organization_admins ───────────────────────────────────────────

create table organization_admins (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  person_id           uuid references persons(id) not null,
  granted_by          uuid references persons(id),
  granted_at          timestamptz default now(),
  unique (organization_id, person_id)
);

-- ── 3. Create group_relationships ───────────────────────────────────────────

create table group_relationships (
  id                      uuid primary key default gen_random_uuid(),
  parent_group_id         uuid references groups(id) not null,
  child_group_id          uuid references groups(id) not null,
  relationship_type_id    uuid references org_relationship_types(id) not null,
  status                  text check (status in ('pending', 'active', 'rejected')) default 'active',
  created_by              uuid references persons(id),
  created_at              timestamptz default now(),
  unique (parent_group_id, child_group_id, relationship_type_id),
  check (parent_group_id != child_group_id)
);

-- ── 4. Restructure organizations ────────────────────────────────────────────

-- The current "organizations" rows are what become "groups".
-- We need a single organization row for "Epsilon Theta" that the groups live under.

-- Strategy: the existing Epsilon Theta row (efd2b...) becomes the organization.
-- We create group rows with NEW IDs, then update all FKs to point to group IDs.

-- Step A: Create chapter group with a NEW ID, referencing ET org
insert into groups (organization_id, name, slug, group_type, features, settings, terminology, is_primary, logo_url, created_at)
select
  'efd2b9e9-a93f-4301-bff5-3cded0181f86',  -- ET org ID
  'Chapter',
  'chapter',
  'chapter',
  features, settings, terminology, true, logo_url, created_at
from organizations
where id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86';

-- Step B: Create SNHC group with a NEW ID, referencing ET org
insert into groups (organization_id, name, slug, group_type, features, settings, terminology, is_primary, logo_url, created_at)
select
  'efd2b9e9-a93f-4301-bff5-3cded0181f86',  -- ET org ID
  'SNHC',
  'snhc',
  'housing_corp',
  features, settings, terminology, false, logo_url, created_at
from organizations
where id = '7f534022-6186-45b9-bc85-4eac0c9543b7';

-- Add FK
alter table groups add constraint groups_organization_id_fkey
  foreign key (organization_id) references organizations(id);

-- Step C: Update the ET org row to be the organization (strip group-level data)
update organizations
set name = 'Epsilon Theta', org_type = 'chapter', features = '{}', settings = '{}', terminology = '{}'
where id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86';

-- ── 5. Rename org_memberships → group_memberships ───────────────────────────

-- Drop old FK to organizations before renaming
alter table org_memberships drop constraint if exists org_memberships_organization_id_fkey;
alter table org_memberships drop constraint if exists org_memberships_org_id_fkey;

alter table org_memberships rename to group_memberships;
alter table group_memberships rename column org_id to group_id;

-- Remap: memberships that pointed to ET org now point to chapter group
update group_memberships
set group_id = (select id from groups where slug = 'chapter' and organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86')
where group_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86';

-- Remap: memberships that pointed to SNHC org now point to snhc group
update group_memberships
set group_id = (select id from groups where slug = 'snhc' and organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86')
where group_id = '7f534022-6186-45b9-bc85-4eac0c9543b7';

-- Add new FK to groups
alter table group_memberships add constraint group_memberships_group_id_fkey
  foreign key (group_id) references groups(id);

-- ── 6. Update all feature tables: org_id → group_id ─────────────────────────

-- Drop ALL possible FK names pointing to old orgs/organizations table
-- (Postgres keeps original FK names even after table renames)
do $$
declare r record;
begin
  for r in (
    select conname, conrelid::regclass::text as tbl
    from pg_constraint
    where contype = 'f'
    and confrelid = 'organizations'::regclass
    and conrelid::regclass::text != 'groups'
    and conrelid::regclass::text != 'organization_admins'
    and conrelid::regclass::text != 'facilities'
    and conrelid::regclass::text != 'national_org_templates'
  ) loop
    execute format('alter table %I drop constraint if exists %I', r.tbl, r.conname);
    raise notice 'Dropped FK % on %', r.conname, r.tbl;
  end loop;
end $$;

alter table role_types rename column org_id to group_id;
alter table positions rename column org_id to group_id;
alter table position_assignments rename column org_id to group_id;
alter table term_definitions rename column org_id to group_id;
alter table terms rename column org_id to group_id;
alter table pledge_classes rename column org_id to group_id;
alter table subgroups rename column org_id to group_id;
alter table event_categories rename column org_id to group_id;
alter table status_definitions rename column org_id to group_id;

-- Remap all feature tables from old org IDs to new group IDs
-- ET chapter data
update role_types set group_id = (select id from groups where slug = 'chapter' and organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86') where group_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86';
update positions set group_id = (select id from groups where slug = 'chapter' and organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86') where group_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86';
update position_assignments set group_id = (select id from groups where slug = 'chapter' and organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86') where group_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86';
update term_definitions set group_id = (select id from groups where slug = 'chapter' and organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86') where group_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86';
update terms set group_id = (select id from groups where slug = 'chapter' and organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86') where group_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86';
update pledge_classes set group_id = (select id from groups where slug = 'chapter' and organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86') where group_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86';
update subgroups set group_id = (select id from groups where slug = 'chapter' and organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86') where group_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86';
update event_categories set group_id = (select id from groups where slug = 'chapter' and organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86') where group_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86';
update status_definitions set group_id = (select id from groups where slug = 'chapter' and organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86') where group_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86';

-- SNHC data
update role_types set group_id = (select id from groups where slug = 'snhc' and organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86') where group_id = '7f534022-6186-45b9-bc85-4eac0c9543b7';
update status_definitions set group_id = (select id from groups where slug = 'snhc' and organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86') where group_id = '7f534022-6186-45b9-bc85-4eac0c9543b7';

-- Facilities belong to organizations (not groups)
-- managed_by should reference a group
alter table facilities drop constraint if exists facilities_managed_by_org_id_fkey;
alter table facilities rename column managed_by_org_id to managed_by_group_id;

-- Remap facility managed_by from old SNHC org ID to new SNHC group ID
update facilities
set managed_by_group_id = (select id from groups where slug = 'snhc')
where managed_by_group_id = '7f534022-6186-45b9-bc85-4eac0c9543b7';

-- ── 7. Add organization_id FK to organization_admins ────────────────────────

alter table organization_admins add constraint organization_admins_org_fkey
  foreign key (organization_id) references organizations(id);

-- ── 8. Delete the SNHC organization row (now a group under ET) ──────────────

-- Move facilities from SNHC org to ET org
update facilities
set organization_id = 'efd2b9e9-a93f-4301-bff5-3cded0181f86'
where organization_id = '7f534022-6186-45b9-bc85-4eac0c9543b7';

-- Now safe to delete SNHC org row
delete from organizations where id = '7f534022-6186-45b9-bc85-4eac0c9543b7';

-- ── 9. Seed organization admin ──────────────────────────────────────────────

insert into organization_admins (organization_id, person_id)
values (
  'efd2b9e9-a93f-4301-bff5-3cded0181f86',  -- ET org
  '524a42db-da41-4e85-9af2-20ddfaa3e614'   -- admin@test.com
)
on conflict do nothing;

-- ── 10. Seed group relationship: SNHC oversees Chapter ──────────────────────

insert into group_relationships (parent_group_id, child_group_id, relationship_type_id, created_by)
select
  (select id from groups where slug = 'snhc'),
  (select id from groups where slug = 'chapter'),
  id,
  '524a42db-da41-4e85-9af2-20ddfaa3e614'
from org_relationship_types
where slug = 'oversees'
on conflict do nothing;

-- ── 11. Drop old org_relationships ──────────────────────────────────────────

drop policy if exists "org_relationships_select" on org_relationships;
drop policy if exists "org_relationships_insert" on org_relationships;
drop policy if exists "org_relationships_update" on org_relationships;
drop policy if exists "org_relationships_delete" on org_relationships;
drop table if exists org_relationships;

-- ── 12. RLS ─────────────────────────────────────────────────────────────────

alter table groups enable row level security;
alter table organization_admins enable row level security;
alter table group_relationships enable row level security;

-- Update helper function: get_my_org_ids → get_my_group_ids
create or replace function get_my_group_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select gm.group_id from group_memberships gm
  join status_definitions sd on sd.id = gm.status_id
  where gm.person_id = auth.uid()
    and sd.slug != 'expelled'
    and gm.ended_at is null
$$;

-- Keep get_my_org_ids as alias for backwards compat during migration
create or replace function get_my_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select get_my_group_ids()
$$;

-- Groups: members can see groups in their org
create policy "groups_select" on groups for select
using (id in (select get_my_group_ids()));

create policy "groups_insert" on groups for insert
with check (
  organization_id in (
    select organization_id from organization_admins where person_id = (select auth.uid())
  )
);

create policy "groups_update" on groups for update
using (
  organization_id in (
    select organization_id from organization_admins where person_id = (select auth.uid())
  )
);

-- Organization admins
create policy "organization_admins_select" on organization_admins for select
using (
  organization_id in (
    select g.organization_id from groups g where g.id in (select get_my_group_ids())
  )
);

create policy "organization_admins_insert" on organization_admins for insert
with check (
  organization_id in (
    select organization_id from organization_admins where person_id = (select auth.uid())
  )
  or exists (select 1 from platform_admins where id = (select auth.uid()))
);

create policy "organization_admins_delete" on organization_admins for delete
using (
  organization_id in (
    select organization_id from organization_admins where person_id = (select auth.uid())
  )
  or exists (select 1 from platform_admins where id = (select auth.uid()))
);

-- Group relationships
create policy "group_relationships_select" on group_relationships for select
using (
  parent_group_id in (select get_my_group_ids())
  or child_group_id in (select get_my_group_ids())
);

create policy "group_relationships_insert" on group_relationships for insert
with check (
  parent_group_id in (select get_my_group_ids())
  or child_group_id in (select get_my_group_ids())
);

-- Update persons RLS to use groups
drop policy if exists "persons_select" on persons;
create policy "persons_select" on persons for select
using (
  id in (
    select gm2.person_id from group_memberships gm1
    join group_memberships gm2 on gm2.group_id = gm1.group_id
    where gm1.person_id = (select auth.uid())
    and gm1.ended_at is null
  )
  or id = (select auth.uid())
);

-- Update existing RLS policies that reference org_memberships
-- (the table was renamed to group_memberships, but the function handles it)
