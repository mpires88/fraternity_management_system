-- ============================================================================
-- Phase 13.1 (schema portion): generalized issues + cross-group escalation
--
-- Layout-pass decision (user-approved): the table is `issues`, not
-- facility_issues — kind carries the variation (maintenance is just the first
-- kind); facility/room links are nullable and only meaningful for facility
-- kinds. reported_by = who submitted; assigned_to = who owns it. Escalation
-- to the overseeing group (group_relationships) works for any kind — the
-- first behavioral use of the oversight edge.
-- ============================================================================

CREATE TABLE issues (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  kind                  text NOT NULL DEFAULT 'maintenance'
                        CHECK (kind IN ('maintenance', 'safety', 'equipment', 'operations', 'other')),
  facility_id           uuid REFERENCES facilities(id) ON DELETE SET NULL,
  room_id               uuid REFERENCES rooms(id) ON DELETE SET NULL,
  location_note         text,
  title                 text NOT NULL,
  description           text,
  photo_paths           text[],
  priority              text NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low', 'medium', 'high', 'emergency')),
  status                text NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'wont_fix')),
  reported_by           uuid NOT NULL REFERENCES persons(id),
  assigned_to           uuid REFERENCES persons(id) ON DELETE SET NULL,
  escalated_to_group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  escalated_at          timestamptz,
  escalated_by          uuid REFERENCES persons(id) ON DELETE SET NULL,
  resolution_note       text,
  resolved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_issues_group_status ON issues(group_id, status);
CREATE INDEX idx_issues_escalated ON issues(escalated_to_group_id);
CREATE INDEX idx_issues_assigned ON issues(assigned_to);

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- Reporting group and the escalated-to group both see the issue
CREATE POLICY "issues_select" ON issues
  FOR SELECT USING (
    group_id IN (SELECT get_my_group_ids())
    OR escalated_to_group_id IN (SELECT get_my_group_ids())
  );

CREATE POLICY "issues_insert" ON issues
  FOR INSERT WITH CHECK (
    reported_by = (SELECT get_my_person_id())
    AND group_id IN (SELECT get_my_group_ids())
  );

-- Triage: group admins of either group; house managers cover facility kinds
-- without needing full admin
CREATE POLICY "issues_update" ON issues
  FOR UPDATE USING (
    group_id IN (SELECT get_my_admin_group_ids())
    OR escalated_to_group_id IN (SELECT get_my_admin_group_ids())
    OR group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
    OR escalated_to_group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
  );

CREATE POLICY "issues_delete" ON issues
  FOR DELETE USING (group_id IN (SELECT get_my_admin_group_ids()));

CREATE TRIGGER issues_audit
  AFTER UPDATE OR DELETE ON issues
  FOR EACH ROW EXECUTE FUNCTION log_data_change();

-- ── issue-photos storage bucket (authenticated-only) ─────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-photos', 'issue-photos', false);

CREATE POLICY "issue_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'issue-photos'
    AND (storage.foldername(name))[1] = (SELECT get_my_person_id())::text
  );

CREATE POLICY "issue_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'issue-photos'
    AND (storage.foldername(name))[1] = (SELECT get_my_person_id())::text
  );

CREATE POLICY "issue_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'issue-photos');

-- ── comments: issues become a commentable surface ────────────────────────────

ALTER TABLE comments DROP CONSTRAINT comments_resource_type_check;
ALTER TABLE comments ADD CONSTRAINT comments_resource_type_check CHECK (
  resource_type IN ('document', 'poll', 'requirement', 'budget', 'issue')
);

CREATE OR REPLACE FUNCTION can_read_comments(
  p_resource_type TEXT,
  p_resource_id   UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE p_resource_type
    WHEN 'document' THEN
      RETURN EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = p_resource_id
          AND d.group_id IN (SELECT get_my_group_ids())
      );
    WHEN 'poll' THEN
      RETURN EXISTS (
        SELECT 1 FROM polls p
        WHERE p.id = p_resource_id
          AND p.group_id IN (SELECT get_my_group_ids())
      );
    WHEN 'requirement' THEN
      RETURN EXISTS (
        SELECT 1 FROM requirements r
        WHERE r.id = p_resource_id
          AND r.group_id IN (SELECT get_my_group_ids())
      );
    WHEN 'budget' THEN
      RETURN EXISTS (
        SELECT 1 FROM budgets b
        WHERE b.id = p_resource_id
          AND (b.group_id IN (SELECT get_my_group_ids())
               OR b.approver_group_id IN (SELECT get_my_group_ids()))
      );
    WHEN 'issue' THEN
      -- Reporting group and escalated-to group may discuss
      RETURN EXISTS (
        SELECT 1 FROM issues i
        WHERE i.id = p_resource_id
          AND (i.group_id IN (SELECT get_my_group_ids())
               OR i.escalated_to_group_id IN (SELECT get_my_group_ids()))
      );
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- ── grants ───────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON issues TO authenticated;
GRANT ALL ON issues TO service_role;
