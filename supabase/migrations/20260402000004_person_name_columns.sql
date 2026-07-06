-- Add granular name fields + profile photo to persons

alter table persons add column if not exists first_name text;
alter table persons add column if not exists middle_name text;
alter table persons add column if not exists last_name text;
alter table persons add column if not exists preferred_name text;
alter table persons add column if not exists family_line text;
alter table persons add column if not exists pledge_class_name text;
alter table persons add column if not exists bid_date date;
