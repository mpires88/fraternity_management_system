-- ============================================================================
-- RLS hardening (from the July 2026 multi-tenant isolation audit)
--
-- 1. Group config tables (role_types, status_definitions, positions, terms,
--    term_definitions) were writable by ANY member of the group; management
--    is an officer surface — gate on get_my_admin_group_ids().
-- 2. notifications_insert validated the sender's group but not that the
--    recipient belongs to it — any member could insert notifications for
--    arbitrary persons in other tenants. New is_person_in_group() helper
--    binds recipient to group (SECURITY DEFINER: policies must never query
--    group_memberships inline — recursion).
-- 3. profile-photos storage select: drop the anon grant. (The bucket itself
--    stays public for avatar rendering via stored public URLs — full
--    privatization would need signed-URL plumbing; deferred.)
-- 4. parent_organizations had no write policy at all — platform-admin
--    updates silently failed under RLS.
-- 5. get_my_organization_ids() still read the dropped org_memberships table
--    (pre-v3) and errored if called; rebuild through groups. The housing
--    re-scope (Phase 12) depends on it.
-- ============================================================================

-- ── 1. Config-table writes → admin-gated ─────────────────────────────────────

DROP POLICY IF EXISTS "role_types_insert" ON role_types;
DROP POLICY IF EXISTS "role_types_update" ON role_types;
DROP POLICY IF EXISTS "role_types_delete" ON role_types;
CREATE POLICY "role_types_insert" ON role_types
  FOR INSERT WITH CHECK (group_id IN (SELECT get_my_admin_group_ids()));
CREATE POLICY "role_types_update" ON role_types
  FOR UPDATE USING (group_id IN (SELECT get_my_admin_group_ids()));
CREATE POLICY "role_types_delete" ON role_types
  FOR DELETE USING (group_id IN (SELECT get_my_admin_group_ids()));

DROP POLICY IF EXISTS "status_definitions_insert" ON status_definitions;
DROP POLICY IF EXISTS "status_definitions_update" ON status_definitions;
DROP POLICY IF EXISTS "status_definitions_delete" ON status_definitions;
CREATE POLICY "status_definitions_insert" ON status_definitions
  FOR INSERT WITH CHECK (group_id IN (SELECT get_my_admin_group_ids()));
-- Global rows (group_id IS NULL) stay platform-admin-only, as before
CREATE POLICY "status_definitions_update" ON status_definitions
  FOR UPDATE USING (
    (group_id IS NULL AND EXISTS (
      SELECT 1 FROM platform_admins WHERE platform_admins.id = (SELECT auth.uid())
    ))
    OR group_id IN (SELECT get_my_admin_group_ids())
  );
CREATE POLICY "status_definitions_delete" ON status_definitions
  FOR DELETE USING (group_id IN (SELECT get_my_admin_group_ids()));

DROP POLICY IF EXISTS "positions_insert" ON positions;
DROP POLICY IF EXISTS "positions_update" ON positions;
DROP POLICY IF EXISTS "positions_delete" ON positions;
CREATE POLICY "positions_insert" ON positions
  FOR INSERT WITH CHECK (group_id IN (SELECT get_my_admin_group_ids()));
CREATE POLICY "positions_update" ON positions
  FOR UPDATE USING (group_id IN (SELECT get_my_admin_group_ids()));
CREATE POLICY "positions_delete" ON positions
  FOR DELETE USING (group_id IN (SELECT get_my_admin_group_ids()));

DROP POLICY IF EXISTS "term_definitions_insert" ON term_definitions;
DROP POLICY IF EXISTS "term_definitions_update" ON term_definitions;
DROP POLICY IF EXISTS "term_definitions_delete" ON term_definitions;
CREATE POLICY "term_definitions_insert" ON term_definitions
  FOR INSERT WITH CHECK (group_id IN (SELECT get_my_admin_group_ids()));
CREATE POLICY "term_definitions_update" ON term_definitions
  FOR UPDATE USING (group_id IN (SELECT get_my_admin_group_ids()));
CREATE POLICY "term_definitions_delete" ON term_definitions
  FOR DELETE USING (group_id IN (SELECT get_my_admin_group_ids()));

DROP POLICY IF EXISTS "terms_insert" ON terms;
DROP POLICY IF EXISTS "terms_update" ON terms;
DROP POLICY IF EXISTS "terms_delete" ON terms;
CREATE POLICY "terms_insert" ON terms
  FOR INSERT WITH CHECK (group_id IN (SELECT get_my_admin_group_ids()));
CREATE POLICY "terms_update" ON terms
  FOR UPDATE USING (group_id IN (SELECT get_my_admin_group_ids()));
CREATE POLICY "terms_delete" ON terms
  FOR DELETE USING (group_id IN (SELECT get_my_admin_group_ids()));

-- ── 2. Notification recipient binding ────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_person_in_group(p_person_id uuid, p_group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_memberships gm
    JOIN status_definitions sd ON sd.id = gm.status_id
    WHERE gm.person_id = p_person_id
      AND gm.group_id = p_group_id
      AND gm.ended_at IS NULL
      AND sd.slug != 'expelled'
  )
$$;

GRANT EXECUTE ON FUNCTION is_person_in_group(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_person_in_group(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (
    group_id IN (SELECT get_my_group_ids())
    AND is_person_in_group(person_id, group_id)
  );

-- ── 3. Profile photos: no anon select via the REST object API ────────────────

DROP POLICY IF EXISTS "profile_photos_select" ON storage.objects;
CREATE POLICY "profile_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'profile-photos');

-- ── 4. parent_organizations: platform-admin writes ───────────────────────────

DROP POLICY IF EXISTS "parent_organizations_update" ON parent_organizations;
CREATE POLICY "parent_organizations_update" ON parent_organizations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE platform_admins.id = (SELECT auth.uid()))
  );

-- ── 5. Rebuild get_my_organization_ids() for the v3 schema ───────────────────

CREATE OR REPLACE FUNCTION get_my_organization_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT g.organization_id
  FROM group_memberships gm
  JOIN groups g ON g.id = gm.group_id
  JOIN status_definitions sd ON sd.id = gm.status_id
  WHERE gm.person_id = (SELECT get_my_person_id())
    AND sd.slug != 'expelled'
    AND gm.ended_at IS NULL
$$;
