-- Fix infinite RLS recursion: org_memberships policy references itself.
-- Solution: security definer function that bypasses RLS to get the user's org IDs.

create or replace function get_my_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from org_memberships
  where person_id = auth.uid() and status != 'expelled'
$$;

create or replace function get_my_fraternity_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select distinct f.id
  from fraternities f
  join orgs o on o.fraternity_id = f.id
  join org_memberships om on om.org_id = o.id
  where om.person_id = auth.uid() and om.status != 'expelled'
$$;

-- Drop all affected policies
drop policy if exists "fraternities_member_select" on fraternities;
drop policy if exists "orgs_member_select" on orgs;
drop policy if exists "term_definitions_select" on term_definitions;
drop policy if exists "terms_select" on terms;
drop policy if exists "pledge_classes_select" on pledge_classes;
drop policy if exists "persons_select" on persons;
drop policy if exists "membership_types_select" on membership_types;
drop policy if exists "org_memberships_select" on org_memberships;
drop policy if exists "positions_select" on positions;
drop policy if exists "position_assignments_select" on position_assignments;
drop policy if exists "subgroups_select" on subgroups;
drop policy if exists "subgroup_members_select" on subgroup_members;
drop policy if exists "event_categories_select" on event_categories;

-- Recreate using the security definer functions (no recursion)

create policy "fraternities_member_select" on fraternities for select
using (id in (select get_my_fraternity_ids()));

create policy "orgs_member_select" on orgs for select
using (id in (select get_my_org_ids()));

create policy "term_definitions_select" on term_definitions for select
using (org_id in (select get_my_org_ids()));

create policy "terms_select" on terms for select
using (org_id in (select get_my_org_ids()));

create policy "pledge_classes_select" on pledge_classes for select
using (org_id in (select get_my_org_ids()));

create policy "persons_select" on persons for select
using (fraternity_id in (select get_my_fraternity_ids()));

create policy "membership_types_select" on membership_types for select
using (org_id in (select get_my_org_ids()));

create policy "org_memberships_select" on org_memberships for select
using (org_id in (select get_my_org_ids()));

create policy "positions_select" on positions for select
using (org_id in (select get_my_org_ids()));

create policy "position_assignments_select" on position_assignments for select
using (org_id in (select get_my_org_ids()));

create policy "subgroups_select" on subgroups for select
using (org_id in (select get_my_org_ids()));

create policy "subgroup_members_select" on subgroup_members for select
using (subgroup_id in (
  select id from subgroups where org_id in (select get_my_org_ids())
));

create policy "event_categories_select" on event_categories for select
using (org_id is null or org_id in (select get_my_org_ids()));
