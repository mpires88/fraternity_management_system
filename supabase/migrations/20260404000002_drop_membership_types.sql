-- Drop old membership model now that everything uses affiliation_types + status_definitions.

-- Remove old FK + columns from org_memberships
alter table org_memberships drop constraint if exists org_memberships_membership_type_id_fkey;
alter table org_memberships drop column if exists membership_type_id;
alter table org_memberships drop column if exists status;
alter table org_memberships drop column if exists position_id;

-- Drop old RLS policies
drop policy if exists "membership_types_select" on membership_types;
drop policy if exists "membership_types_insert" on membership_types;
drop policy if exists "membership_types_update" on membership_types;

-- Drop old table
drop table if exists membership_types;
