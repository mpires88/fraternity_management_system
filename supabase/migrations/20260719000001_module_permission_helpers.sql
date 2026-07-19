-- ============================================================================
-- Phase 9.1 (schema portion): module-level permission helpers
--
-- Module rights = full-access role OR active holder of a position whose
-- system role carries the module flag (system_position_roles.is_rush_chair /
-- is_treasurer / is_house_manager — dormant columns until now). Lets the rush
-- chair, treasurer, and house manager manage their module without full admin.
--
-- Also get_my_position_ids() (Phase 11 schema): current position holderships,
-- used by budget-proposal and reimbursement policies.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_my_module_admin_group_ids(p_module text)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id FROM get_my_admin_group_ids() AS group_id
  UNION
  SELECT pa.group_id
  FROM position_assignments pa
  JOIN positions p ON p.id = pa.position_id
  JOIN system_position_roles spr ON spr.id = p.system_role_id
  WHERE pa.person_id = (SELECT get_my_person_id())
    AND pa.term_end IS NULL
    AND (
      (p_module = 'rush' AND spr.is_rush_chair IS TRUE)
      OR (p_module = 'treasurer' AND spr.is_treasurer IS TRUE)
      OR (p_module = 'house_manager' AND spr.is_house_manager IS TRUE)
    )
$$;

GRANT EXECUTE ON FUNCTION get_my_module_admin_group_ids(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_module_admin_group_ids(text) TO service_role;

CREATE OR REPLACE FUNCTION get_my_position_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pa.position_id
  FROM position_assignments pa
  WHERE pa.person_id = (SELECT get_my_person_id())
    AND pa.term_end IS NULL
$$;

GRANT EXECUTE ON FUNCTION get_my_position_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_position_ids() TO service_role;
