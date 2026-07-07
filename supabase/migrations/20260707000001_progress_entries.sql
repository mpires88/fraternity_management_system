-- requirement_progress_entries: audit trail of partial fulfillment
-- (dues payments, logged hours, quota increments)

create table requirement_progress_entries (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references requirement_assignments(id) on delete cascade,
  amount numeric not null,
  occurred_on date not null default current_date,
  note text,
  logged_by uuid not null references persons(id),
  approved_by uuid references persons(id),
  created_at timestamptz not null default now()
);

-- Index for lookups by assignment
create index idx_progress_entries_assignment on requirement_progress_entries(assignment_id);

-- RLS
alter table requirement_progress_entries enable row level security;

-- Members can see entries for assignments in their groups
create policy "requirement_progress_entries_select" on requirement_progress_entries
  for select using (
    assignment_id in (
      select ra.id from requirement_assignments ra
      join requirements r on r.id = ra.requirement_id
      where r.group_id in (select get_my_group_ids())
    )
  );

-- Members can insert entries for their own assignments; officers can insert for any
create policy "requirement_progress_entries_insert" on requirement_progress_entries
  for insert with check (
    assignment_id in (
      select ra.id from requirement_assignments ra
      where ra.person_id = auth.uid()
    )
    or assignment_id in (
      select ra.id from requirement_assignments ra
      join requirements r on r.id = ra.requirement_id
      where r.group_id in (select get_my_admin_group_ids())
    )
  );

-- Only officers can update (approve/reject)
create policy "requirement_progress_entries_update" on requirement_progress_entries
  for update using (
    assignment_id in (
      select ra.id from requirement_assignments ra
      join requirements r on r.id = ra.requirement_id
      where r.group_id in (select get_my_admin_group_ids())
    )
  );

-- Only officers can delete
create policy "requirement_progress_entries_delete" on requirement_progress_entries
  for delete using (
    assignment_id in (
      select ra.id from requirement_assignments ra
      join requirements r on r.id = ra.requirement_id
      where r.group_id in (select get_my_admin_group_ids())
    )
  );

-- Audit trigger
create trigger requirement_progress_entries_audit
  after update or delete on requirement_progress_entries
  for each row execute function log_data_change();
