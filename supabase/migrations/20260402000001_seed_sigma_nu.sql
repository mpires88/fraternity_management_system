-- Seed: National Org Registry
-- Sigma Nu Fraternity, Inc.

insert into national_organizations (id, name, abbreviation, org_type, founded_year, website, status) values
  ('00000000-0000-0000-0000-000000000001', 'Sigma Nu Fraternity, Inc.', 'ΣΝ', 'fraternity', 1869, 'https://sigmanu.org', 'active');

-- Undergraduate chapter template
insert into national_org_templates (national_org_id, chapter_type, display_name, default_features, term_structure, is_default) values
  (
    '00000000-0000-0000-0000-000000000001',
    'undergraduate',
    'Undergraduate Chapter',
    '{
      "members": true,
      "announcements": true,
      "documents": true,
      "meetings": true,
      "events": true,
      "budget": true,
      "dues": true,
      "elections": true,
      "voting": true,
      "house": true,
      "rush": true,
      "tasks": true,
      "subgroups": true
    }',
    'semester',
    true
  );

-- Housing corporation template
insert into national_org_templates (national_org_id, chapter_type, display_name, default_features, term_structure, is_default) values
  (
    '00000000-0000-0000-0000-000000000001',
    'housing_corp',
    'Housing Corporation',
    '{
      "members": true,
      "announcements": true,
      "documents": true,
      "meetings": true,
      "events": true,
      "budget": true,
      "dues": false,
      "elections": true,
      "voting": true,
      "house": true,
      "rush": false,
      "tasks": true,
      "subgroups": true
    }',
    'annual',
    false
  );

-- Alumni chapter template
insert into national_org_templates (national_org_id, chapter_type, display_name, default_features, term_structure, is_default) values
  (
    '00000000-0000-0000-0000-000000000001',
    'alumni_chapter',
    'Alumni Chapter',
    '{
      "members": true,
      "announcements": true,
      "documents": true,
      "meetings": true,
      "events": true,
      "budget": true,
      "dues": true,
      "elections": true,
      "voting": true,
      "house": false,
      "rush": false,
      "tasks": true,
      "subgroups": false
    }',
    'annual',
    false
  );
