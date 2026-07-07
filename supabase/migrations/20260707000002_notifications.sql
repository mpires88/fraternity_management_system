-- notifications: one row per recipient, fan-out model
create table notifications (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references persons(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  type text not null,
  group_key text,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_person on notifications(person_id, read_at);
create index idx_notifications_group_key on notifications(person_id, group_key);

alter table notifications enable row level security;

create policy "notifications_select" on notifications
  for select using (person_id = auth.uid());

create policy "notifications_insert" on notifications
  for insert with check (
    group_id in (select get_my_group_ids())
    or group_id in (select get_my_admin_group_ids())
  );

create policy "notifications_update" on notifications
  for update using (person_id = auth.uid());

-- notification_preferences: per-person email settings
create table notification_preferences (
  person_id uuid primary key references persons(id) on delete cascade,
  email_enabled boolean not null default false,
  email_digest boolean not null default true,
  calendar_feed_token uuid default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notification_preferences enable row level security;

create policy "notification_preferences_select" on notification_preferences
  for select using (person_id = auth.uid());

create policy "notification_preferences_insert" on notification_preferences
  for insert with check (person_id = auth.uid());

create policy "notification_preferences_update" on notification_preferences
  for update using (person_id = auth.uid());
