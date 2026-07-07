-- ============================================================================
-- 20260707000004_documents_comments.sql
-- Phase 6: Documents + polymorphic comments + document-poll approval link
-- ============================================================================

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  term_id             UUID        REFERENCES terms(id) ON DELETE SET NULL,

  title               TEXT        NOT NULL,
  kind                TEXT        NOT NULL DEFAULT 'other',
  body                TEXT,

  -- Lifecycle: draft → in_review → approved → archived
  status              TEXT        NOT NULL DEFAULT 'draft',
  submitted_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  approved_by         UUID        REFERENCES persons(id) ON DELETE SET NULL,

  -- Versioning
  version             INT         NOT NULL DEFAULT 1,
  parent_document_id  UUID        REFERENCES documents(id) ON DELETE SET NULL,

  -- File upload (Supabase Storage path)
  file_path           TEXT,
  file_name           TEXT,
  file_type           TEXT,

  -- Approval via poll
  poll_id             UUID        REFERENCES polls(id) ON DELETE SET NULL,

  created_by          UUID        NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT documents_approved_consistency CHECK (
    approved_at IS NULL OR approved_by IS NOT NULL
  ),
  CONSTRAINT documents_kind_check CHECK (
    kind IN ('minutes', 'bylaws', 'budget', 'other')
  ),
  CONSTRAINT documents_status_check CHECK (
    status IN ('draft', 'in_review', 'approved', 'archived')
  )
);

CREATE INDEX IF NOT EXISTS idx_documents_group
  ON documents(group_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_term
  ON documents(term_id) WHERE term_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_parent
  ON documents(parent_document_id) WHERE parent_document_id IS NOT NULL;


-- ============================================================================
-- COMMENTS (polymorphic, threaded)
-- ============================================================================

CREATE TABLE IF NOT EXISTS comments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,

  -- Polymorphic resource linking (no FK; validated by RLS gate functions)
  resource_type       TEXT        NOT NULL,
  resource_id         UUID        NOT NULL,

  -- Threading
  parent_comment_id   UUID        REFERENCES comments(id) ON DELETE CASCADE,

  -- Content
  body                TEXT        NOT NULL,
  visibility          TEXT        NOT NULL DEFAULT 'internal',

  -- Resolution
  resolved_at         TIMESTAMPTZ,
  resolved_by         UUID        REFERENCES persons(id) ON DELETE SET NULL,

  -- Text anchoring (context-based, not bare offsets)
  anchor_text             TEXT,
  anchor_context_before   TEXT,
  anchor_context_after    TEXT,
  anchor_metadata         JSONB,

  created_by          UUID        NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT comments_resolved_consistency CHECK (
    (resolved_at IS NULL AND resolved_by IS NULL)
    OR (resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
  ),
  CONSTRAINT comments_no_self_parent CHECK (
    parent_comment_id IS NULL OR parent_comment_id != id
  ),
  CONSTRAINT comments_resource_type_check CHECK (
    resource_type IN ('document', 'poll', 'requirement')
  )
);

CREATE INDEX IF NOT EXISTS idx_comments_resource
  ON comments(resource_type, resource_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_group
  ON comments(group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_parent
  ON comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comments_unresolved
  ON comments(group_id, resource_type)
  WHERE resolved_at IS NULL;


-- ============================================================================
-- COMMENT-REQUIREMENT LINKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS comment_requirement_links (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id              UUID        NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  requirement_assignment_id UUID      NOT NULL REFERENCES requirement_assignments(id) ON DELETE CASCADE,
  created_by              UUID        NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, requirement_assignment_id)
);

CREATE INDEX IF NOT EXISTS idx_crl_comment ON comment_requirement_links(comment_id);
CREATE INDEX IF NOT EXISTS idx_crl_assignment ON comment_requirement_links(requirement_assignment_id);


-- ============================================================================
-- POLLS: add document_id link
-- ============================================================================

ALTER TABLE polls ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL;


-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Read gate: can the current user see comments on this resource?
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
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Write gate: can the current user create comments on this resource?
CREATE OR REPLACE FUNCTION can_write_comments(
  p_resource_type TEXT,
  p_resource_id   UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Same as read gate for our model: group members can comment
  RETURN can_read_comments(p_resource_type, p_resource_id);
END;
$$;

-- Trigger: parent_comment_id must reference same resource
CREATE OR REPLACE FUNCTION validate_comment_parent_resource()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM comments
      WHERE id = NEW.parent_comment_id
        AND resource_type = NEW.resource_type
        AND resource_id = NEW.resource_id
    ) THEN
      RAISE EXCEPTION 'parent_comment_id must reference a comment on the same resource'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: only the author can modify body/anchor fields; anyone can resolve
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

  IF OLD.created_by != (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Only the comment author can modify content fields'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

-- Auto-update updated_at on documents
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();

CREATE TRIGGER trg_comments_validate_parent
  BEFORE INSERT OR UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION validate_comment_parent_resource();

CREATE TRIGGER trg_comments_author_content
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION enforce_comment_author_on_content_update();


-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_requirement_links ENABLE ROW LEVEL SECURITY;

-- Documents: group members can read
CREATE POLICY documents_select ON documents
  FOR SELECT TO authenticated
  USING (group_id IN (SELECT get_my_group_ids()));

-- Documents: group admins can insert
CREATE POLICY documents_insert ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND group_id IN (SELECT get_my_admin_group_ids())
  );

-- Documents: group admins can update
CREATE POLICY documents_update ON documents
  FOR UPDATE TO authenticated
  USING (group_id IN (SELECT get_my_admin_group_ids()))
  WITH CHECK (group_id IN (SELECT get_my_admin_group_ids()));

-- Documents: group admins can delete (draft only enforced at app layer)
CREATE POLICY documents_delete ON documents
  FOR DELETE TO authenticated
  USING (group_id IN (SELECT get_my_admin_group_ids()));

-- Comments: read if can access the resource
CREATE POLICY comments_select ON comments
  FOR SELECT TO authenticated
  USING (can_read_comments(resource_type, resource_id));

-- Comments: insert if group member of the resource
CREATE POLICY comments_insert ON comments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND can_write_comments(resource_type, resource_id)
  );

-- Comments: update (resolve or edit own)
CREATE POLICY comments_update ON comments
  FOR UPDATE TO authenticated
  USING (can_read_comments(resource_type, resource_id))
  WITH CHECK (can_read_comments(resource_type, resource_id));

-- Comments: delete own only
CREATE POLICY comments_delete ON comments
  FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Comment-requirement links: visible if can see the comment
CREATE POLICY crl_select ON comment_requirement_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM comments c
      WHERE c.id = comment_requirement_links.comment_id
        AND can_read_comments(c.resource_type, c.resource_id)
    )
  );

-- Comment-requirement links: admins can insert
CREATE POLICY crl_insert ON comment_requirement_links
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM comments c
      WHERE c.id = comment_requirement_links.comment_id
        AND c.group_id IN (SELECT get_my_admin_group_ids())
    )
  );

-- Comment-requirement links: creator can delete
CREATE POLICY crl_delete ON comment_requirement_links
  FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()));


-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO authenticated;
GRANT ALL ON documents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON comments TO authenticated;
GRANT ALL ON comments TO service_role;

GRANT SELECT, INSERT, DELETE ON comment_requirement_links TO authenticated;
GRANT ALL ON comment_requirement_links TO service_role;

GRANT EXECUTE ON FUNCTION can_read_comments(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_read_comments(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION can_write_comments(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_write_comments(TEXT, UUID) TO service_role;
