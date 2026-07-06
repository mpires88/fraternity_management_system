-- House management tables (spec Part 10) + extended room details from Airtable

create table house (
  id               uuid primary key default gen_random_uuid(),
  fraternity_id    uuid references fraternities(id) not null,
  name             text not null,
  address          text,
  managed_by_org_id uuid references orgs(id)
);

create table rooms (
  id            uuid primary key default gen_random_uuid(),
  house_id      uuid references house(id) not null,
  name          text not null,
  type          text check (type in ('single', 'double', 'common', 'bathroom', 'storage', 'study', 'lounge', 'service', 'other')),
  floor         int,
  capacity      int default 1,
  is_active     boolean default true,
  display_order int,
  -- Extended fields from Airtable
  nickname      text,
  room_number   text,
  square_footage int,
  floor_plan_code text,
  floor_plan_use text,
  description   text,
  beds          int default 0,
  mattresses    int default 0,
  dressers      int default 0,
  desks         int default 0,
  desk_chairs   int default 0,
  book_shelves  int default 0,
  closets       int default 0,
  sofas         int default 0,
  loft_kits     int default 0,
  ideal_capacity int
);

create table room_assignments (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid references rooms(id) not null,
  member_id  uuid references persons(id) not null,
  term_id    uuid references terms(id) not null,
  starts_on  date not null,
  ends_on    date,
  notes      text,
  unique (room_id, member_id, term_id)
);

-- RLS
alter table house enable row level security;
alter table rooms enable row level security;
alter table room_assignments enable row level security;

create policy "house_select" on house for select
using (fraternity_id in (select get_my_fraternity_ids()));

create policy "rooms_select" on rooms for select
using (house_id in (select id from house where fraternity_id in (select get_my_fraternity_ids())));

create policy "room_assignments_select" on room_assignments for select
using (room_id in (
  select r.id from rooms r
  join house h on h.id = r.house_id
  where h.fraternity_id in (select get_my_fraternity_ids())
));

create policy "room_assignments_insert" on room_assignments for insert
with check (room_id in (
  select r.id from rooms r
  join house h on h.id = r.house_id
  where h.fraternity_id in (select get_my_fraternity_ids())
));
