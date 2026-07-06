-- RLS for subgroup management

create policy "subgroups_insert" on subgroups for insert
with check (org_id in (select get_my_org_ids()));

create policy "subgroups_update" on subgroups for update
using (org_id in (select get_my_org_ids()));

create policy "subgroups_delete" on subgroups for delete
using (org_id in (select get_my_org_ids()) and not is_locked);

create policy "subgroup_members_insert" on subgroup_members for insert
with check (subgroup_id in (
  select id from subgroups where org_id in (select get_my_org_ids())
));

create policy "subgroup_members_update" on subgroup_members for update
using (subgroup_id in (
  select id from subgroups where org_id in (select get_my_org_ids())
));
