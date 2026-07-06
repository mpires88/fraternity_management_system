-- Family line data migrated to subgroups (type='family_line').
-- Drop the redundant column from persons.

alter table persons drop column if exists family_line;
