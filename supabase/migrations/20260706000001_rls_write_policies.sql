-- Task 0.5: Add missing write RLS policies
-- Restricted to org admins (via organization_admins) or platform admins.

-- ── groups: DELETE ─────────────────────────────────────────────────────────────
-- Matches existing groups_insert / groups_update pattern: org admins only.
CREATE POLICY "groups_delete" ON "public"."groups"
  FOR DELETE USING (
    "organization_id" IN (
      SELECT "organization_admins"."organization_id"
      FROM "public"."organization_admins"
      WHERE "organization_admins"."person_id" = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM "public"."platform_admins"
      WHERE "platform_admins"."id" = auth.uid()
    )
  );

-- ── group_relationships: UPDATE ────────────────────────────────────────────────
-- Matches existing group_relationships_insert pattern.
CREATE POLICY "group_relationships_update" ON "public"."group_relationships"
  FOR UPDATE USING (
    "parent_group_id" IN (SELECT get_my_group_ids())
    OR "child_group_id" IN (SELECT get_my_group_ids())
  );

-- ── group_relationships: DELETE ────────────────────────────────────────────────
CREATE POLICY "group_relationships_delete" ON "public"."group_relationships"
  FOR DELETE USING (
    "parent_group_id" IN (SELECT get_my_group_ids())
    OR "child_group_id" IN (SELECT get_my_group_ids())
  );

-- ── organization_admins: UPDATE ────────────────────────────────────────────────
-- Matches existing organization_admins_insert / _delete pattern.
CREATE POLICY "organization_admins_update" ON "public"."organization_admins"
  FOR UPDATE USING (
    "organization_id" IN (
      SELECT "organization_admins"."organization_id"
      FROM "public"."organization_admins"
      WHERE "organization_admins"."person_id" = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM "public"."platform_admins"
      WHERE "platform_admins"."id" = auth.uid()
    )
  );

-- ── role_types: DELETE ─────────────────────────────────────────────────────────
-- Matches existing role_types_insert / _update pattern.
CREATE POLICY "role_types_delete" ON "public"."role_types"
  FOR DELETE USING (
    "group_id" IN (SELECT get_my_group_ids())
  );

-- ── status_definitions: DELETE ─────────────────────────────────────────────────
-- Matches existing status_definitions_insert pattern (group-scoped only).
CREATE POLICY "status_definitions_delete" ON "public"."status_definitions"
  FOR DELETE USING (
    "group_id" IN (SELECT get_my_group_ids())
  );

-- ── positions: INSERT / UPDATE / DELETE ────────────────────────────────────────
-- Admin tab manages positions; matches role_types pattern.
CREATE POLICY "positions_insert" ON "public"."positions"
  FOR INSERT WITH CHECK (
    "group_id" IN (SELECT get_my_group_ids())
  );

CREATE POLICY "positions_update" ON "public"."positions"
  FOR UPDATE USING (
    "group_id" IN (SELECT get_my_group_ids())
  );

CREATE POLICY "positions_delete" ON "public"."positions"
  FOR DELETE USING (
    "group_id" IN (SELECT get_my_group_ids())
  );

-- ── term_definitions: INSERT / UPDATE / DELETE ─────────────────────────────────
-- Needed for task 0.7 (term management admin tab).
CREATE POLICY "term_definitions_insert" ON "public"."term_definitions"
  FOR INSERT WITH CHECK (
    "group_id" IN (SELECT get_my_group_ids())
  );

CREATE POLICY "term_definitions_update" ON "public"."term_definitions"
  FOR UPDATE USING (
    "group_id" IN (SELECT get_my_group_ids())
  );

CREATE POLICY "term_definitions_delete" ON "public"."term_definitions"
  FOR DELETE USING (
    "group_id" IN (SELECT get_my_group_ids())
  );

-- ── terms: INSERT / UPDATE / DELETE ────────────────────────────────────────────
-- Needed for task 0.7 (create/manage terms).
CREATE POLICY "terms_insert" ON "public"."terms"
  FOR INSERT WITH CHECK (
    "group_id" IN (SELECT get_my_group_ids())
  );

CREATE POLICY "terms_update" ON "public"."terms"
  FOR UPDATE USING (
    "group_id" IN (SELECT get_my_group_ids())
  );

CREATE POLICY "terms_delete" ON "public"."terms"
  FOR DELETE USING (
    "group_id" IN (SELECT get_my_group_ids())
  );
