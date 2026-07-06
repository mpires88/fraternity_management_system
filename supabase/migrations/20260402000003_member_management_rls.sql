-- RLS policies for member management (officers can update memberships)

-- Officers (exec/officer permission_level) can update org_memberships in their org
create policy "org_memberships_update" on org_memberships for update
using (org_id in (select get_my_org_ids()))
with check (org_id in (select get_my_org_ids()));

-- Officers can insert org_memberships (invite flow)
create policy "org_memberships_insert" on org_memberships for insert
with check (org_id in (select get_my_org_ids()));

-- Platform admins can manage all membership types
create policy "membership_types_insert" on membership_types for insert
with check (
  exists (select 1 from platform_admins where id = (select auth.uid()))
  or org_id in (select get_my_org_ids())
);

create policy "membership_types_update" on membership_types for update
using (
  exists (select 1 from platform_admins where id = (select auth.uid()))
  or org_id in (select get_my_org_ids())
);
