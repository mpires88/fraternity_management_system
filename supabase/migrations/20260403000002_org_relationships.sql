-- Org-to-org relationships (e.g. SNHC oversees Epsilon Theta)

create table org_relationship_types (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null,
  name                  text not null,
  description           text,
  -- Default data visibility for this relationship type
  default_permissions   jsonb not null default '{
    "can_view_members": false,
    "can_view_leadership": true,
    "can_view_financials": false,
    "can_view_events": false,
    "can_view_documents": false,
    "can_view_housing": false,
    "can_view_roster_count": true
  }'
);

insert into org_relationship_types (slug, name, description, default_permissions) values
  ('oversees', 'Oversees', 'Parent org oversees operations of child org', '{
    "can_view_members": true,
    "can_view_leadership": true,
    "can_view_financials": true,
    "can_view_events": true,
    "can_view_documents": true,
    "can_view_housing": true,
    "can_view_roster_count": true
  }'),
  ('advises', 'Advises', 'Advisory relationship with visibility into key metrics', '{
    "can_view_members": true,
    "can_view_leadership": true,
    "can_view_financials": false,
    "can_view_events": true,
    "can_view_documents": false,
    "can_view_housing": false,
    "can_view_roster_count": true
  }'),
  ('governs', 'Governs', 'Governing body with full visibility', '{
    "can_view_members": true,
    "can_view_leadership": true,
    "can_view_financials": true,
    "can_view_events": true,
    "can_view_documents": true,
    "can_view_housing": true,
    "can_view_roster_count": true
  }'),
  ('supports', 'Supports', 'Supporting org with limited visibility', '{
    "can_view_members": false,
    "can_view_leadership": true,
    "can_view_financials": false,
    "can_view_events": true,
    "can_view_documents": false,
    "can_view_housing": false,
    "can_view_roster_count": true
  }');

create table org_relationships (
  id                    uuid primary key default gen_random_uuid(),
  parent_org_id         uuid references orgs(id) not null,
  child_org_id          uuid references orgs(id) not null,
  relationship_type_id  uuid references org_relationship_types(id) not null,
  -- Override default permissions for this specific relationship
  permissions_override  jsonb,
  notes                 text,
  created_at            timestamptz default now(),
  unique (parent_org_id, child_org_id, relationship_type_id),
  check (parent_org_id != child_org_id)
);

-- RLS
alter table org_relationship_types enable row level security;
create policy "org_relationship_types_select" on org_relationship_types for select
using (auth.uid() is not null);

alter table org_relationships enable row level security;
create policy "org_relationships_select" on org_relationships for select
using (
  parent_org_id in (select get_my_org_ids())
  or child_org_id in (select get_my_org_ids())
);

create policy "org_relationships_insert" on org_relationships for insert
with check (parent_org_id in (select get_my_org_ids()));

create policy "org_relationships_update" on org_relationships for update
using (parent_org_id in (select get_my_org_ids()));

create policy "org_relationships_delete" on org_relationships for delete
using (parent_org_id in (select get_my_org_ids()));

-- Platform admins can manage relationship types
create policy "org_relationship_types_admin_all" on org_relationship_types for all
using (exists (select 1 from platform_admins where id = (select auth.uid())));
