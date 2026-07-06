-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Fraternities (top-level tenants)
create table fraternities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  logo_url   text,
  created_at timestamptz default now()
);

-- Platform admins (you)
create table platform_admins (
  id         uuid references auth.users primary key,
  email      text not null,
  created_at timestamptz default now()
);

-- Orgs within a fraternity
create table orgs (
  id            uuid primary key default gen_random_uuid(),
  fraternity_id uuid references fraternities(id) not null,
  name          text not null,
  slug          text not null,
  org_type      text not null,
  features      jsonb default '{}',
  settings      jsonb default '{}',
  created_at    timestamptz default now(),
  unique (fraternity_id, slug)
);

-- Enable Row Level Security on all tables
alter table fraternities    enable row level security;
alter table platform_admins enable row level security;
alter table orgs            enable row level security;

-- Basic RLS policies (we'll expand these as we build)
create policy "platform admins can do everything on fraternities"
on fraternities for all
using (exists (
  select 1 from platform_admins where id = auth.uid()
));

create policy "platform admins can do everything on orgs"
on orgs for all
using (exists (
  select 1 from platform_admins where id = auth.uid()
));