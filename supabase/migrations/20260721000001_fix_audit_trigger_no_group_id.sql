-- ============================================================================
-- Fix log_data_change() for tables without a group_id column.
--
-- The trigger used `new.group_id` which PL/pgSQL resolves at compile time —
-- tables without that column (budget_line_items, budget_proposals,
-- event_prospect_attendance, room_assignments, etc.) raised:
--   "record 'new' has no field 'group_id'"
--
-- Fix: convert the record to JSONB first, then extract group_id via ->>
-- which returns NULL when the key is absent.
-- ============================================================================

CREATE OR REPLACE FUNCTION log_data_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_jsonb_new jsonb;
  v_jsonb_old jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_jsonb_old := to_jsonb(old);
    v_group_id := (v_jsonb_old ->> 'group_id')::uuid;
    INSERT INTO data_change_log (table_name, record_id, group_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, old.id, v_group_id, 'DELETE', v_jsonb_old, (SELECT get_my_person_id()));
    RETURN old;
  ELSE
    v_jsonb_new := to_jsonb(new);
    v_jsonb_old := to_jsonb(old);
    v_group_id := (v_jsonb_new ->> 'group_id')::uuid;
    INSERT INTO data_change_log (table_name, record_id, group_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, new.id, v_group_id, 'UPDATE', v_jsonb_old, v_jsonb_new, (SELECT get_my_person_id()));
    RETURN new;
  END IF;
END;
$$;
