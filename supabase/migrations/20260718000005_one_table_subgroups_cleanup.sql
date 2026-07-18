-- ============================================================================
-- One-table decision for member classes (schema layout pass, July 2026)
--
-- New member classes are subgroups (subgroup_type), not a standalone table.
-- pledge_classes has 0 rows and no readers; persons.pledge_class_id and
-- subgroups.pledge_class_id are the only things keeping it alive.
--
-- Also renames the type value pledge_class -> new_member_class while the
-- rename is free (no rows use it): the internal value is tradition-neutral;
-- display names come from each group's terminology jsonb ("Candidate Class"
-- for Sigma Nu, "Line" for NPHC, ...).
-- ============================================================================

-- ── 1. Rename the subgroup type value ────────────────────────────────────────

ALTER TABLE subgroups DROP CONSTRAINT IF EXISTS subgroups_subgroup_type_check;

UPDATE subgroups SET subgroup_type = 'new_member_class' WHERE subgroup_type = 'pledge_class';

ALTER TABLE subgroups ADD CONSTRAINT subgroups_subgroup_type_check
  CHECK (subgroup_type = ANY (ARRAY[
    'committee'::text,
    'exec_board'::text,
    'new_member_class'::text,
    'house_residents'::text,
    'ad_hoc'::text,
    'family_line'::text,
    'advisory_board'::text
  ]));

-- ── 2. Drop the legacy table + the FKs that kept it alive ────────────────────

ALTER TABLE persons DROP COLUMN IF EXISTS pledge_class_id;
ALTER TABLE subgroups DROP COLUMN IF EXISTS pledge_class_id;
DROP TABLE IF EXISTS pledge_classes;
