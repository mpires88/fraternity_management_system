-- Fix organizations RLS: allow group members to see their org

drop policy if exists "organizations_select" on organizations;
create policy "organizations_select" on organizations for select
using (
  id in (
    select g.organization_id from groups g
    where g.id in (select get_my_group_ids())
  )
  or exists (select 1 from platform_admins where id = (select auth.uid()))
);
