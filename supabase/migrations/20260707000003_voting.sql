-- polls: core voting entity
create table polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  term_id uuid references terms(id) on delete set null,
  title text not null,
  description text,

  -- two-axis state
  lifecycle text not null default 'draft'
    check (lifecycle in ('draft', 'published', 'archived')),
  status text not null default 'open'
    check (status in ('open', 'closed')),

  -- timing
  opens_at timestamptz,
  closes_at timestamptz,

  -- method
  voting_method text not null default 'plurality'
    check (voting_method in ('plurality', 'approval', 'supermajority', 'rcv')),
  method_settings jsonb not null default '{}',
  vote_privacy text not null default 'public'
    check (vote_privacy in ('public', 'private')),

  -- governance
  quorum int,
  allow_proxies boolean not null default false,
  allow_abstain boolean not null default true,

  created_by uuid not null references persons(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_polls_group on polls(group_id);

alter table polls enable row level security;

create policy "polls_select" on polls
  for select using (group_id in (select get_my_group_ids()));

create policy "polls_insert" on polls
  for insert with check (group_id in (select get_my_admin_group_ids()));

create policy "polls_update" on polls
  for update using (group_id in (select get_my_admin_group_ids()));

create policy "polls_delete" on polls
  for delete using (group_id in (select get_my_admin_group_ids()));


-- poll_options: choices for a poll (immutable after creation)
create table poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  label text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_poll_options_poll on poll_options(poll_id);

alter table poll_options enable row level security;

create policy "poll_options_select" on poll_options
  for select using (
    poll_id in (select id from polls where group_id in (select get_my_group_ids()))
  );

create policy "poll_options_insert" on poll_options
  for insert with check (
    poll_id in (select id from polls where group_id in (select get_my_admin_group_ids()))
  );


-- poll_participants: who is eligible to vote
create table poll_participants (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  person_id uuid references persons(id) on delete cascade,
  invitation_token uuid default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (poll_id, person_id)
);

create index idx_poll_participants_poll on poll_participants(poll_id);
create index idx_poll_participants_token on poll_participants(invitation_token);

alter table poll_participants enable row level security;

create policy "poll_participants_select" on poll_participants
  for select using (
    person_id = auth.uid()
    or poll_id in (select id from polls where group_id in (select get_my_admin_group_ids()))
  );

create policy "poll_participants_insert" on poll_participants
  for insert with check (
    poll_id in (select id from polls where group_id in (select get_my_admin_group_ids()))
  );

create policy "poll_participants_delete" on poll_participants
  for delete using (
    poll_id in (select id from polls where group_id in (select get_my_admin_group_ids()))
  );


-- votes: immutable ballots — no UPDATE or DELETE policies
create table votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  person_id uuid not null references persons(id),
  cast_by_person_id uuid references persons(id),
  vote_data jsonb not null,
  created_at timestamptz not null default now(),
  unique (poll_id, person_id)
);

create index idx_votes_poll on votes(poll_id);

alter table votes enable row level security;

create policy "votes_select" on votes
  for select using (
    person_id = auth.uid()
    or poll_id in (select id from polls where group_id in (select get_my_admin_group_ids()))
    or poll_id in (
      select id from polls
      where group_id in (select get_my_group_ids())
      and vote_privacy = 'public'
      and status = 'closed'
    )
  );

create policy "votes_insert" on votes
  for insert with check (
    poll_id in (
      select id from polls
      where group_id in (select get_my_group_ids())
      and lifecycle = 'published'
      and status = 'open'
    )
    and (
      person_id = auth.uid()
      or (
        cast_by_person_id = auth.uid()
        and poll_id in (select id from polls where allow_proxies = true)
      )
    )
  );

-- trigger: enforce one vote per person per poll (redundant with unique constraint,
-- but gives a better error message)
create or replace function enforce_vote_person_id()
returns trigger as $$
begin
  if exists (
    select 1 from votes where poll_id = NEW.poll_id and person_id = NEW.person_id
  ) then
    raise exception 'Person has already voted in this poll';
  end if;

  -- enforce poll is open
  if not exists (
    select 1 from polls
    where id = NEW.poll_id and lifecycle = 'published' and status = 'open'
  ) then
    raise exception 'Poll is not open for voting';
  end if;

  return NEW;
end;
$$ language plpgsql;

create trigger trg_enforce_vote
  before insert on votes
  for each row execute function enforce_vote_person_id();
