-- ============================================================================
-- Person PII minimization (isolation-audit task 8.12)
--
-- persons_select exposes the full row to every group-mate; DOB, home address,
-- and emergency-contact linkage were visible to any brother in any shared
-- group. Those columns move to person_sensitive_details with RLS restricted
-- to the person themself + full-access admins of a group they belong to.
--
-- Deliberately NO log_data_change() audit trigger here: the change log is
-- readable by group admins and would duplicate the PII outside this table's
-- tighter scoping.
-- ============================================================================

-- ── 1. Table ─────────────────────────────────────────────────────────────────

CREATE TABLE person_sensitive_details (
  person_id                       uuid PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE,
  date_of_birth                   date,
  street_address                  text,
  city                            text,
  state                           text,
  country                         text,
  emergency_contact_person_id     uuid REFERENCES persons(id),
  emergency_contact_relationship  text,
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Backfill from persons ─────────────────────────────────────────────────

INSERT INTO person_sensitive_details (
  person_id, date_of_birth, street_address, city, state, country,
  emergency_contact_person_id, emergency_contact_relationship
)
SELECT
  id, date_of_birth, street_address, city, state, country,
  emergency_contact_person_id, emergency_contact_relationship
FROM persons
WHERE date_of_birth IS NOT NULL
   OR street_address IS NOT NULL
   OR city IS NOT NULL
   OR state IS NOT NULL
   OR country IS NOT NULL
   OR emergency_contact_person_id IS NOT NULL
   OR emergency_contact_relationship IS NOT NULL;

-- ── 3. RLS: self + admins of a shared group ──────────────────────────────────

CREATE OR REPLACE FUNCTION can_admin_view_person(p_person_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.person_id = p_person_id
      AND gm.ended_at IS NULL
      AND gm.group_id IN (SELECT get_my_admin_group_ids())
  )
$$;

GRANT EXECUTE ON FUNCTION can_admin_view_person(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_admin_view_person(uuid) TO service_role;

ALTER TABLE person_sensitive_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "person_sensitive_details_select" ON person_sensitive_details
  FOR SELECT USING (
    person_id = (SELECT get_my_person_id())
    OR can_admin_view_person(person_id)
  );

CREATE POLICY "person_sensitive_details_insert" ON person_sensitive_details
  FOR INSERT WITH CHECK (
    person_id = (SELECT get_my_person_id())
    OR can_admin_view_person(person_id)
  );

CREATE POLICY "person_sensitive_details_update" ON person_sensitive_details
  FOR UPDATE USING (
    person_id = (SELECT get_my_person_id())
    OR can_admin_view_person(person_id)
  );

CREATE POLICY "person_sensitive_details_delete" ON person_sensitive_details
  FOR DELETE USING (can_admin_view_person(person_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON person_sensitive_details TO authenticated;
GRANT ALL ON person_sensitive_details TO service_role;

-- ── 4. Drop the columns from persons ─────────────────────────────────────────

ALTER TABLE persons
  DROP COLUMN date_of_birth,
  DROP COLUMN street_address,
  DROP COLUMN city,
  DROP COLUMN state,
  DROP COLUMN country,
  DROP COLUMN emergency_contact_person_id,
  DROP COLUMN emergency_contact_relationship;
