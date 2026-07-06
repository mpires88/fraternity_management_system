-- ============================================================================
-- Refactor: membership_types → affiliation_types + status_definitions
--
-- Affiliation type = what you ARE to the org (member, advisor, boarder)
--   → carries base permissions
-- Status = your current standing (active, candidate, probated, alumni)
--   → overrides affiliation permissions (can only restrict, never grant)
-- ============================================================================

-- ── 1. Create new tables ────────────────────────────────────────────────────

create table affiliation_types (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id) not null,
  name                  text not null,
  slug                  text not null,
  description           text,
  is_default            boolean default false,
  -- Base permissions for this affiliation
  access_level          text check (access_level in ('full', 'limited', 'read_only', 'none')) not null,
  can_vote              boolean default false,
  can_hold_office       boolean default false,
  can_attend_events     boolean default true,
  can_view_roster       boolean default true,
  can_view_financials   boolean default false,
  can_submit_expenses   boolean default false,
  can_view_minutes      boolean default true,
  can_speak_at_meetings boolean default true,
  can_view_documents    boolean default true,
  -- Display
  color                 text,
  display_order         int,
  unique (org_id, slug)
);

create table status_definitions (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid references orgs(id),  -- null = base/platform status
  name                  text not null,
  slug                  text not null,
  description           text,
  is_base               boolean default false,     -- platform-defined, can't be removed
  -- Permission overrides (null = no override, use affiliation value)
  override_access_level text check (override_access_level in ('full', 'limited', 'read_only', 'none')),
  override_can_vote              boolean,
  override_can_hold_office       boolean,
  override_can_attend_events     boolean,
  override_can_view_roster       boolean,
  override_can_view_financials   boolean,
  override_can_submit_expenses   boolean,
  override_can_view_minutes      boolean,
  override_can_speak_at_meetings boolean,
  override_can_view_documents    boolean,
  -- Display
  color                 text,
  display_order         int
);

-- Unique slug per org (null org_id = platform base statuses)
create unique index status_definitions_org_slug_idx
  on status_definitions (coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

-- ── 2. Seed base statuses (platform-wide) ───────────────────────────────────

insert into status_definitions (org_id, name, slug, is_base, description, color, display_order,
  override_access_level, override_can_vote, override_can_hold_office, override_can_attend_events,
  override_can_view_roster, override_can_view_financials, override_can_submit_expenses,
  override_can_view_minutes, override_can_speak_at_meetings, override_can_view_documents)
values
  (null, 'Active', 'active', true, 'In good standing, full participation',
   null, 1,
   null, null, null, null, null, null, null, null, null, null),
  (null, 'Candidate', 'candidate', true, 'Pledge / new member in process',
   '#0891b2', 2,
   'limited', null, false, null, null, null, null, null, null, null),
  (null, 'Away', 'away', true, 'Good standing but temporarily away',
   '#6b7280', 3,
   'limited', false, false, null, null, null, null, null, null, null),
  (null, 'Expelled', 'expelled', true, 'Permanently removed',
   '#dc2626', 4,
   'none', false, false, false, false, false, false, false, false, false);

-- ── 3. Add columns to org_memberships ───────────────────────────────────────

alter table org_memberships add column affiliation_type_id uuid references affiliation_types(id);
alter table org_memberships add column status_id uuid references status_definitions(id);

-- ── 4. RLS ──────────────────────────────────────────────────────────────────

alter table affiliation_types enable row level security;
create policy "affiliation_types_select" on affiliation_types for select
using (org_id in (select get_my_org_ids()));
create policy "affiliation_types_insert" on affiliation_types for insert
with check (org_id in (select get_my_org_ids()));
create policy "affiliation_types_update" on affiliation_types for update
using (org_id in (select get_my_org_ids()));

alter table status_definitions enable row level security;
create policy "status_definitions_select" on status_definitions for select
using (org_id is null or org_id in (select get_my_org_ids()));
create policy "status_definitions_insert" on status_definitions for insert
with check (org_id in (select get_my_org_ids()));
create policy "status_definitions_update" on status_definitions for update
using (org_id is null and exists(select 1 from platform_admins where id = (select auth.uid()))
  or org_id in (select get_my_org_ids()));
