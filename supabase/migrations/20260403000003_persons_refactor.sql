-- Persons table refactor:
-- 1. Rename email → school_email
-- 2. Emergency contact as FK to persons (not text fields)
-- 3. Drop redundant columns
-- 4. Drop person_contacts table (merged into persons)
-- 5. Add family_line subgroup type
-- 6. Migrate pledge_class and family_line to subgroups

-- ── 1. Rename email → school_email ──────────────────────────────────────────

alter table persons rename column email to school_email;

-- ── 2. Emergency contact as person FK ───────────────────────────────────────

alter table persons add column emergency_contact_person_id uuid references persons(id);

-- Migrate existing person_contacts data into the new column
update persons p
set emergency_contact_person_id = pc.contact_person_id,
    emergency_contact_relationship = pc.relationship
from person_contacts pc
where pc.person_id = p.id
  and pc.is_primary = true;

-- For anyone who didn't have is_primary set, take the first contact
update persons p
set emergency_contact_person_id = pc.contact_person_id,
    emergency_contact_relationship = pc.relationship
from person_contacts pc
where pc.person_id = p.id
  and p.emergency_contact_person_id is null;

-- ── 3. Drop redundant columns ───────────────────────────────────────────────

alter table persons drop column if exists address;
alter table persons drop column if exists emergency_contact;
alter table persons drop column if exists emergency_contact_name;
alter table persons drop column if exists emergency_contact_phone;
alter table persons drop column if exists pledge_class_name;

-- ── 4. Drop person_contacts table ───────────────────────────────────────────

drop policy if exists "person_contacts_select" on person_contacts;
drop policy if exists "person_contacts_insert" on person_contacts;
drop policy if exists "person_contacts_update" on person_contacts;
drop policy if exists "person_contacts_delete" on person_contacts;
drop table if exists person_contacts;

-- ── 5. Add family_line subgroup type ────────────────────────────────────────

-- Drop and recreate the check constraint to add 'family_line'
alter table subgroups drop constraint if exists subgroups_subgroup_type_check;
alter table subgroups add constraint subgroups_subgroup_type_check
  check (subgroup_type in ('committee', 'exec_board', 'pledge_class', 'house_residents', 'ad_hoc', 'family_line'));
