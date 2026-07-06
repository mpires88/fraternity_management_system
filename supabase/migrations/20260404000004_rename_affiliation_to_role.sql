-- Rename affiliation_types → role_types, affiliation_type_id → role_type_id

alter table affiliation_types rename to role_types;
alter table org_memberships rename column affiliation_type_id to role_type_id;

-- Update RLS policy names
drop policy if exists "affiliation_types_select" on role_types;
drop policy if exists "affiliation_types_insert" on role_types;
drop policy if exists "affiliation_types_update" on role_types;

create policy "role_types_select" on role_types for select
using (org_id in (select get_my_org_ids()));
create policy "role_types_insert" on role_types for insert
with check (org_id in (select get_my_org_ids()));
create policy "role_types_update" on role_types for update
using (org_id in (select get_my_org_ids()));
