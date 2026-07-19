-- ============================================================================
-- Platform-admin visibility: super admins can see every organization and
-- group (needed for the sidebar org/group switchers and cross-org
-- navigation). Additive permissive policies — existing member-scoped
-- policies stay untouched.
-- ============================================================================

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins WHERE id = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO service_role;

CREATE POLICY "organizations_platform_admin_select" ON organizations
  FOR SELECT USING (is_platform_admin());

CREATE POLICY "groups_platform_admin_select" ON groups
  FOR SELECT USING (is_platform_admin());
