-- ============================================================================
-- PHASE 1: Requirements engine core
--
-- Tables: requirements, requirement_assignments, data_change_log
-- Helpers: get_my_admin_group_ids(), log_data_change()
-- ============================================================================

-- ── 1. Admin group IDs helper ──────────────────────────────────────────────

create or replace function get_my_admin_group_ids()
returns setof uuid
language sql stable security definer
set search_path to 'public'
as $$
  select gm.group_id
  from group_memberships gm
  join status_definitions sd on sd.id = gm.status_id
  join role_types rt on rt.id = gm.role_type_id
  where gm.person_id = auth.uid()
    and sd.slug != 'expelled'
    and gm.ended_at is null
    and rt.access_level = 'full'
$$;

-- ── 2. Requirements table ──────────────────────────────────────────────────

create table requirements (
  id                     uuid primary key default gen_random_uuid(),
  group_id               uuid references groups(id) not null,
  term_id                uuid references terms(id) not null,
  created_by             uuid references persons(id) not null,
  title                  text not null,
  description            text,
  kind                   text not null check (kind in ('task', 'payment', 'attendance', 'quota')),
  due_at                 timestamptz,
  occurs_at              timestamptz,
  amount_cents           int,
  quota_target           numeric,
  quota_unit             text,
  requires_verification  boolean not null default false,
  assign_to              text not null default 'all_active'
                         check (assign_to in ('all_active', 'role_types', 'positions', 'subgroups', 'custom')),
  audience_role_type_ids uuid[],
  audience_position_ids  uuid[],
  audience_subgroup_ids  uuid[],
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ── 3. Requirement assignments table ───────────────────────────────────────

create table requirement_assignments (
  id                uuid primary key default gen_random_uuid(),
  requirement_id    uuid references requirements(id) on delete cascade not null,
  person_id         uuid references persons(id) not null,
  status            text not null default 'pending'
                    check (status in ('pending', 'submitted', 'complete', 'waived')),
  progress          numeric not null default 0,
  completed_at      timestamptz,
  verified_by       uuid references persons(id),
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (requirement_id, person_id)
);

-- ── 4. Data change log (audit) ─────────────────────────────────────────────

create table data_change_log (
  id            uuid primary key default gen_random_uuid(),
  table_name    text not null,
  record_id     uuid not null,
  group_id      uuid references groups(id),
  action        text not null check (action in ('UPDATE', 'DELETE')),
  old_data      jsonb,
  new_data      jsonb,
  changed_by    uuid default auth.uid(),
  changed_at    timestamptz not null default now()
);

create index data_change_log_record_idx on data_change_log (table_name, record_id);
create index data_change_log_group_idx on data_change_log (group_id);

-- Audit trigger function
create or replace function log_data_change()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_group_id uuid;
begin
  -- Extract group_id from the row if the column exists
  if TG_OP = 'DELETE' then
    v_group_id := case when old ? 'group_id' then (old->>'group_id')::uuid else null end;
    insert into data_change_log (table_name, record_id, group_id, action, old_data, changed_by)
    values (TG_TABLE_NAME, old.id, v_group_id, 'DELETE', to_jsonb(old), auth.uid());
    return old;
  else
    v_group_id := case when to_jsonb(new) ? 'group_id' then new.group_id else null end;
    insert into data_change_log (table_name, record_id, group_id, action, old_data, new_data, changed_by)
    values (TG_TABLE_NAME, new.id, v_group_id, 'UPDATE', to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  end if;
end;
$$;

-- Attach triggers
create trigger requirements_audit
  after update or delete on requirements
  for each row execute function log_data_change();

create trigger requirement_assignments_audit
  after update or delete on requirement_assignments
  for each row execute function log_data_change();

-- ── 5. Enable RLS ──────────────────────────────────────────────────────────

alter table requirements enable row level security;
alter table requirement_assignments enable row level security;
alter table data_change_log enable row level security;

-- ── 6. RLS policies — requirements ─────────────────────────────────────────

-- All group members can see requirements
create policy "requirements_select" on requirements
  for select using (group_id in (select get_my_group_ids()));

-- Only full-access members can create/edit/delete
create policy "requirements_insert" on requirements
  for insert with check (group_id in (select get_my_admin_group_ids()));

create policy "requirements_update" on requirements
  for update using (group_id in (select get_my_admin_group_ids()));

create policy "requirements_delete" on requirements
  for delete using (group_id in (select get_my_admin_group_ids()));

-- ── 7. RLS policies — requirement_assignments ──────────────────────────────

-- Members see own assignments; full-access see all for their groups
create policy "requirement_assignments_select" on requirement_assignments
  for select using (
    person_id = auth.uid()
    or requirement_id in (
      select id from requirements where group_id in (select get_my_admin_group_ids())
    )
  );

-- Only full-access can create assignments (audience expansion)
create policy "requirement_assignments_insert" on requirement_assignments
  for insert with check (
    requirement_id in (
      select id from requirements where group_id in (select get_my_admin_group_ids())
    )
  );

-- Full-access can update any assignment; members can update own pending→submitted/complete
create policy "requirement_assignments_update" on requirement_assignments
  for update using (
    person_id = auth.uid()
    or requirement_id in (
      select id from requirements where group_id in (select get_my_admin_group_ids())
    )
  );

-- Only full-access can delete
create policy "requirement_assignments_delete" on requirement_assignments
  for delete using (
    requirement_id in (
      select id from requirements where group_id in (select get_my_admin_group_ids())
    )
  );

-- ── 8. RLS policies — data_change_log ──────────────────────────────────────

-- Read-only to full-access members of the group
create policy "data_change_log_select" on data_change_log
  for select using (group_id in (select get_my_admin_group_ids()));

-- No direct writes — only the trigger inserts
-- (service_role bypasses RLS, and the trigger runs as SECURITY DEFINER)

-- ── 9. Grants ──────────────────────────────────────────────────────────────

grant all on table requirements to anon, authenticated, service_role;
grant all on table requirement_assignments to anon, authenticated, service_role;
grant all on table data_change_log to anon, authenticated, service_role;
