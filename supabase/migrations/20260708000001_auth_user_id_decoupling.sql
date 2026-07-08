-- ============================================================================
-- Decouple auth identity from person identity
--
-- Adds persons.auth_user_id (nullable, partial-unique) so person records can
-- exist before their owner signs up. Backfills existing rows so current
-- logins are unaffected. Creates get_my_person_id() and rewrites every RLS
-- policy / helper that previously used auth.uid() as a person_id.
-- ============================================================================

-- ── 1. Add column + backfill ─────────────────────────────────────────────────

ALTER TABLE persons ADD COLUMN auth_user_id uuid;
CREATE UNIQUE INDEX idx_persons_auth_user_id
  ON persons(auth_user_id) WHERE auth_user_id IS NOT NULL;
UPDATE persons SET auth_user_id = id;

-- ── 2. Identity-resolution helper ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_person_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM persons WHERE auth_user_id = auth.uid()
$$;

-- ── 3. Update SECURITY DEFINER helpers ───────────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_group_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gm.group_id FROM group_memberships gm
  JOIN status_definitions sd ON sd.id = gm.status_id
  WHERE gm.person_id = (SELECT get_my_person_id())
    AND sd.slug != 'expelled'
    AND gm.ended_at IS NULL
$$;

CREATE OR REPLACE FUNCTION get_my_admin_group_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gm.group_id
  FROM group_memberships gm
  JOIN status_definitions sd ON sd.id = gm.status_id
  JOIN role_types rt ON rt.id = gm.role_type_id
  WHERE gm.person_id = (SELECT get_my_person_id())
    AND sd.slug != 'expelled'
    AND gm.ended_at IS NULL
    AND rt.access_level = 'full'
$$;

-- get_my_org_ids() delegates to get_my_group_ids() — no change needed

-- ── 4. Update audit trigger ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_data_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_group_id := CASE WHEN to_jsonb(old) ? 'group_id' THEN (old.group_id)::uuid ELSE NULL END;
    INSERT INTO data_change_log (table_name, record_id, group_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, old.id, v_group_id, 'DELETE', to_jsonb(old), (SELECT get_my_person_id()));
    RETURN old;
  ELSE
    v_group_id := CASE WHEN to_jsonb(new) ? 'group_id' THEN new.group_id ELSE NULL END;
    INSERT INTO data_change_log (table_name, record_id, group_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, new.id, v_group_id, 'UPDATE', to_jsonb(old), to_jsonb(new), (SELECT get_my_person_id()));
    RETURN new;
  END IF;
END;
$$;

ALTER TABLE data_change_log ALTER COLUMN changed_by SET DEFAULT get_my_person_id();

-- ── 5. Update comment author trigger ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_comment_author_on_content_update()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    OLD.body IS NOT DISTINCT FROM NEW.body
    AND OLD.anchor_text IS NOT DISTINCT FROM NEW.anchor_text
    AND OLD.anchor_context_before IS NOT DISTINCT FROM NEW.anchor_context_before
    AND OLD.anchor_context_after IS NOT DISTINCT FROM NEW.anchor_context_after
    AND OLD.anchor_metadata IS NOT DISTINCT FROM NEW.anchor_metadata
  ) THEN
    RETURN NEW;
  END IF;

  IF OLD.created_by != (SELECT get_my_person_id()) THEN
    RAISE EXCEPTION 'Only the comment author can modify content fields'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 6. Persons policies ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "persons_select" ON persons;
CREATE POLICY "persons_select" ON persons FOR SELECT
USING (
  id IN (
    SELECT gm2.person_id FROM group_memberships gm1
    JOIN group_memberships gm2 ON gm2.group_id = gm1.group_id
    WHERE gm1.person_id = (SELECT get_my_person_id())
    AND gm1.ended_at IS NULL
  )
  OR id = (SELECT get_my_person_id())
);

DROP POLICY IF EXISTS "persons_update" ON persons;
CREATE POLICY "persons_update" ON persons FOR UPDATE
USING (id = (SELECT get_my_person_id()));

-- ── 7. Notifications policies ────────────────────────────────────────────────

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (person_id = (SELECT get_my_person_id()));

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (person_id = (SELECT get_my_person_id()));

-- notifications_insert uses get_my_group_ids() / get_my_admin_group_ids() — already updated

-- ── 8. Notification preferences policies ─────────────────────────────────────

DROP POLICY IF EXISTS "notification_preferences_select" ON notification_preferences;
CREATE POLICY "notification_preferences_select" ON notification_preferences
  FOR SELECT USING (person_id = (SELECT get_my_person_id()));

DROP POLICY IF EXISTS "notification_preferences_insert" ON notification_preferences;
CREATE POLICY "notification_preferences_insert" ON notification_preferences
  FOR INSERT WITH CHECK (person_id = (SELECT get_my_person_id()));

DROP POLICY IF EXISTS "notification_preferences_update" ON notification_preferences;
CREATE POLICY "notification_preferences_update" ON notification_preferences
  FOR UPDATE USING (person_id = (SELECT get_my_person_id()));

-- ── 9. Poll participants policies ────────────────────────────────────────────

DROP POLICY IF EXISTS "poll_participants_select" ON poll_participants;
CREATE POLICY "poll_participants_select" ON poll_participants
  FOR SELECT USING (
    person_id = (SELECT get_my_person_id())
    OR poll_id IN (SELECT id FROM polls WHERE group_id IN (SELECT get_my_admin_group_ids()))
  );

-- ── 10. Votes policies ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "votes_select" ON votes;
CREATE POLICY "votes_select" ON votes
  FOR SELECT USING (
    person_id = (SELECT get_my_person_id())
    OR poll_id IN (SELECT id FROM polls WHERE group_id IN (SELECT get_my_admin_group_ids()))
    OR poll_id IN (
      SELECT id FROM polls
      WHERE group_id IN (SELECT get_my_group_ids())
      AND vote_privacy = 'public'
      AND status = 'closed'
    )
  );

DROP POLICY IF EXISTS "votes_insert" ON votes;
CREATE POLICY "votes_insert" ON votes
  FOR INSERT WITH CHECK (
    poll_id IN (
      SELECT id FROM polls
      WHERE group_id IN (SELECT get_my_group_ids())
      AND lifecycle = 'published'
      AND status = 'open'
    )
    AND (
      person_id = (SELECT get_my_person_id())
      OR (
        cast_by_person_id = (SELECT get_my_person_id())
        AND poll_id IN (SELECT id FROM polls WHERE allow_proxies = true)
      )
    )
  );

-- ── 11. Requirement assignments policies ─────────────────────────────────────

DROP POLICY IF EXISTS "requirement_assignments_select" ON requirement_assignments;
CREATE POLICY "requirement_assignments_select" ON requirement_assignments
  FOR SELECT USING (
    person_id = (SELECT get_my_person_id())
    OR requirement_id IN (
      SELECT id FROM requirements WHERE group_id IN (SELECT get_my_admin_group_ids())
    )
  );

DROP POLICY IF EXISTS "requirement_assignments_update" ON requirement_assignments;
CREATE POLICY "requirement_assignments_update" ON requirement_assignments
  FOR UPDATE USING (
    person_id = (SELECT get_my_person_id())
    OR requirement_id IN (
      SELECT id FROM requirements WHERE group_id IN (SELECT get_my_admin_group_ids())
    )
  );

-- ── 12. Requirement progress entries ─────────────────────────────────────────

DROP POLICY IF EXISTS "requirement_progress_entries_insert" ON requirement_progress_entries;
CREATE POLICY "requirement_progress_entries_insert" ON requirement_progress_entries
  FOR INSERT WITH CHECK (
    assignment_id IN (
      SELECT ra.id FROM requirement_assignments ra
      WHERE ra.person_id = (SELECT get_my_person_id())
    )
    OR assignment_id IN (
      SELECT ra.id FROM requirement_assignments ra
      JOIN requirements r ON r.id = ra.requirement_id
      WHERE r.group_id IN (SELECT get_my_admin_group_ids())
    )
  );

-- ── 13. Documents policies ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT get_my_person_id())
    AND group_id IN (SELECT get_my_admin_group_ids())
  );

-- ── 14. Comments policies ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT get_my_person_id())
    AND can_write_comments(resource_type, resource_id)
  );

DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments
  FOR DELETE TO authenticated
  USING (created_by = (SELECT get_my_person_id()));

-- ── 15. Comment-requirement links policies ───────────────────────────────────

DROP POLICY IF EXISTS "crl_insert" ON comment_requirement_links;
CREATE POLICY "crl_insert" ON comment_requirement_links
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT get_my_person_id())
    AND EXISTS (
      SELECT 1 FROM comments c
      WHERE c.id = comment_requirement_links.comment_id
        AND c.group_id IN (SELECT get_my_admin_group_ids())
    )
  );

DROP POLICY IF EXISTS "crl_delete" ON comment_requirement_links;
CREATE POLICY "crl_delete" ON comment_requirement_links
  FOR DELETE TO authenticated
  USING (created_by = (SELECT get_my_person_id()));

-- ── 16. Groups policies (organization_admins.person_id references) ───────────
-- Note: platform_admins.id = auth.uid() stays — it's auth-level, not person-level

DROP POLICY IF EXISTS "groups_insert" ON groups;
CREATE POLICY "groups_insert" ON groups FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_admins
    WHERE person_id = (SELECT get_my_person_id())
  )
);

DROP POLICY IF EXISTS "groups_update" ON groups;
CREATE POLICY "groups_update" ON groups FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM organization_admins
    WHERE person_id = (SELECT get_my_person_id())
  )
);

DROP POLICY IF EXISTS "groups_delete" ON groups;
CREATE POLICY "groups_delete" ON groups FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM organization_admins
    WHERE person_id = (SELECT get_my_person_id())
  )
  OR EXISTS (SELECT 1 FROM platform_admins WHERE id = (SELECT auth.uid()))
);

-- ── 17. Organization admins policies ─────────────────────────────────────────

DROP POLICY IF EXISTS "organization_admins_insert" ON organization_admins;
CREATE POLICY "organization_admins_insert" ON organization_admins FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_admins
    WHERE person_id = (SELECT get_my_person_id())
  )
  OR EXISTS (SELECT 1 FROM platform_admins WHERE id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "organization_admins_delete" ON organization_admins;
CREATE POLICY "organization_admins_delete" ON organization_admins FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM organization_admins
    WHERE person_id = (SELECT get_my_person_id())
  )
  OR EXISTS (SELECT 1 FROM platform_admins WHERE id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "organization_admins_update" ON organization_admins;
CREATE POLICY "organization_admins_update" ON organization_admins FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM organization_admins
    WHERE person_id = (SELECT get_my_person_id())
  )
  OR EXISTS (SELECT 1 FROM platform_admins WHERE id = (SELECT auth.uid()))
);
