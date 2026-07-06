-- Replace single address and emergency_contact text fields with structured columns

alter table persons add column if not exists street_address text;
alter table persons add column if not exists city text;
alter table persons add column if not exists state text;
alter table persons add column if not exists country text;

alter table persons add column if not exists emergency_contact_name text;
alter table persons add column if not exists emergency_contact_phone text;
alter table persons add column if not exists emergency_contact_relationship text;
