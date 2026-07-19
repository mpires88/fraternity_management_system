-- ============================================================================
-- Phase 12.1: re-scope facilities / rooms / room_assignments to the v3 model
--
-- These tables predate the groups refactor: selects used the deprecated
-- get_my_org_ids() alias and there were NO write policies at all. rooms holds
-- real imported data — this migration is additive + policy swap only.
--
-- Reads: org-wide (chapter AND housing corp see the house and occupancy).
-- Writes: house-manager gate on the managing group. Lottery self-picks flow
-- through a SECURITY DEFINER trigger (next migration), not widened writes.
--
-- LOCKED DECISION: room_assignments is the canonical, METHOD-AGNOSTIC table.
-- The lottery is one optional producer; direct assignment (summer boarders,
-- price-based, any org's own method) is first-class. Nothing may assume an
-- assignment came from a draft.
-- ============================================================================

-- ── 1. Facilities are managed by a group (the housing corp) ──────────────────

ALTER TABLE facilities ADD COLUMN IF NOT EXISTS managed_by_group_id uuid REFERENCES groups(id);

UPDATE facilities f
SET managed_by_group_id = (
  SELECT g.id FROM groups g
  WHERE g.organization_id = f.organization_id
    AND g.group_type = 'housing_corp'
  LIMIT 1
)
WHERE managed_by_group_id IS NULL;

-- ── 2. Policy swap ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "facilities_select" ON facilities;
DROP POLICY IF EXISTS "rooms_select" ON rooms;
DROP POLICY IF EXISTS "room_assignments_select" ON room_assignments;

CREATE POLICY "facilities_select" ON facilities
  FOR SELECT USING (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "facilities_update" ON facilities
  FOR UPDATE USING (managed_by_group_id IN (SELECT get_my_module_admin_group_ids('house_manager')));

CREATE POLICY "rooms_select" ON rooms
  FOR SELECT USING (
    facility_id IN (
      SELECT id FROM facilities WHERE organization_id IN (SELECT get_my_organization_ids())
    )
  );

CREATE POLICY "rooms_insert" ON rooms
  FOR INSERT WITH CHECK (
    facility_id IN (
      SELECT id FROM facilities
      WHERE managed_by_group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
    )
  );

CREATE POLICY "rooms_update" ON rooms
  FOR UPDATE USING (
    facility_id IN (
      SELECT id FROM facilities
      WHERE managed_by_group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
    )
  );

CREATE POLICY "rooms_delete" ON rooms
  FOR DELETE USING (
    facility_id IN (
      SELECT id FROM facilities
      WHERE managed_by_group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
    )
  );

CREATE POLICY "room_assignments_select" ON room_assignments
  FOR SELECT USING (
    room_id IN (
      SELECT r.id FROM rooms r
      JOIN facilities f ON f.id = r.facility_id
      WHERE f.organization_id IN (SELECT get_my_organization_ids())
    )
  );

CREATE POLICY "room_assignments_insert" ON room_assignments
  FOR INSERT WITH CHECK (
    room_id IN (
      SELECT r.id FROM rooms r
      JOIN facilities f ON f.id = r.facility_id
      WHERE f.managed_by_group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
    )
  );

CREATE POLICY "room_assignments_update" ON room_assignments
  FOR UPDATE USING (
    room_id IN (
      SELECT r.id FROM rooms r
      JOIN facilities f ON f.id = r.facility_id
      WHERE f.managed_by_group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
    )
  );

CREATE POLICY "room_assignments_delete" ON room_assignments
  FOR DELETE USING (
    room_id IN (
      SELECT r.id FROM rooms r
      JOIN facilities f ON f.id = r.facility_id
      WHERE f.managed_by_group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
    )
  );

-- ── 3. Audit ─────────────────────────────────────────────────────────────────

CREATE TRIGGER rooms_audit
  AFTER UPDATE OR DELETE ON rooms
  FOR EACH ROW EXECUTE FUNCTION log_data_change();

CREATE TRIGGER room_assignments_audit
  AFTER UPDATE OR DELETE ON room_assignments
  FOR EACH ROW EXECUTE FUNCTION log_data_change();
