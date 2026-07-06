-- Person contacts: links members to emergency contacts, parents, spouses, etc.
-- Contact persons get their own auth account + org membership with limited access.

create table person_contacts (
  id                uuid primary key default gen_random_uuid(),
  person_id         uuid references persons(id) not null,   -- the member
  contact_person_id uuid references persons(id) not null,   -- the contact (parent, spouse, etc.)
  relationship      text not null check (relationship in (
    'parent', 'guardian', 'spouse', 'partner', 'sibling', 'other'
  )),
  is_emergency      boolean default true,
  is_primary        boolean default false,
  notes             text,
  created_at        timestamptz default now(),
  unique (person_id, contact_person_id)
);

alter table person_contacts enable row level security;

create policy "person_contacts_select" on person_contacts for select
using (
  -- members can see contacts for people in their org
  person_id in (
    select om.person_id from org_memberships om
    where om.org_id in (select get_my_org_ids())
  )
  -- contacts can see their own contact records
  or contact_person_id = (select auth.uid())
);

create policy "person_contacts_insert" on person_contacts for insert
with check (
  person_id in (
    select om.person_id from org_memberships om
    where om.org_id in (select get_my_org_ids())
  )
);

create policy "person_contacts_update" on person_contacts for update
using (
  person_id in (
    select om.person_id from org_memberships om
    where om.org_id in (select get_my_org_ids())
  )
);

create policy "person_contacts_delete" on person_contacts for delete
using (
  person_id in (
    select om.person_id from org_memberships om
    where om.org_id in (select get_my_org_ids())
  )
);
