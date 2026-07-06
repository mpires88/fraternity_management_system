-- Update RLS helper functions to use status_definitions instead of the dropped status column.

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
  join status_definitions sd on sd.id = om.status_id
  where om.person_id = auth.uid()
    and sd.slug != 'expelled'
$$;
