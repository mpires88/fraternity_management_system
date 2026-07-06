-- Allow multiple roles per person per org.
-- A person can be Member + Advisor + Parent simultaneously.
-- Each role has its own status and date range.
-- Effective permissions = most permissive across all active roles.

-- Drop the unique constraint that limits one role per person per org
alter table org_memberships drop constraint if exists org_memberships_person_id_org_id_key;

-- Add date tracking for role history
alter table org_memberships add column if not exists started_at date default current_date;
alter table org_memberships add column if not exists ended_at date;

-- Backfill started_at from joined_at where available
update org_memberships set started_at = joined_at where joined_at is not null and started_at is null;

-- New unique: a person can't have the same role type twice in the same org simultaneously
-- (but can have Member + Advisor + Parent)
create unique index org_memberships_active_role_idx
  on org_memberships (person_id, org_id, role_type_id)
  where ended_at is null;
