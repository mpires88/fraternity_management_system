-- ============================================================================
-- Phase 11.1 + 11.5 (schema portions): budgets, proposals, line items,
-- reimbursements.
--
-- Layout-pass decisions (user-approved): budgets are NOT documents (kind
-- 'budget' on documents stays for file attachments only); MULTIPLE budgets
-- per group per term (unique on title — "Operating Budget", "Officer
-- Expenses", "House Bill"); CROSS-GROUP approval via approver_group_id (SNHC
-- approves the house bill and the recruitment budget); a GENERAL proposal
-- (no position/subgroup) carries line items for budgets like the house bill;
-- category stays plain text; no stored totals — computed in lib; domain
-- tables point AT polls (budgets.poll_id), never the reverse.
--
-- Reimbursements: any member submits with receipts against an officer's
-- budget area; the area officer approves; the treasurer resolves as paid out
-- or applied as a credit (a requirement_progress_entry on a payment
-- assignment — reuses the payments engine; no ledger table). Audit trigger
-- YES: financial dispute records are what data_change_log is for.
-- ============================================================================

-- ── budgets ──────────────────────────────────────────────────────────────────

CREATE TABLE budgets (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id             uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  term_id              uuid NOT NULL REFERENCES terms(id),
  title                text NOT NULL DEFAULT 'Operating Budget',
  status               text NOT NULL DEFAULT 'drafting'
                       CHECK (status IN ('drafting', 'in_review', 'approved', 'ratified', 'archived')),
  approval_mode        text NOT NULL DEFAULT 'approver'
                       CHECK (approval_mode IN ('approver', 'vote', 'approver_then_vote')),
  approver_group_id    uuid REFERENCES groups(id) ON DELETE SET NULL,
  approver_position_id uuid REFERENCES positions(id) ON DELETE SET NULL,
  submitted_at         timestamptz,
  approved_at          timestamptz,
  approved_by          uuid REFERENCES persons(id) ON DELETE SET NULL,
  poll_id              uuid REFERENCES polls(id) ON DELETE SET NULL,
  ratified_at          timestamptz,
  created_by           uuid NOT NULL REFERENCES persons(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, term_id, title)
);

CREATE INDEX idx_budgets_group_term ON budgets(group_id, term_id);
CREATE INDEX idx_budgets_approver_group ON budgets(approver_group_id);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Visible to the owning group AND the approver group (cross-group approval)
CREATE POLICY "budgets_select" ON budgets
  FOR SELECT USING (
    group_id IN (SELECT get_my_group_ids())
    OR approver_group_id IN (SELECT get_my_group_ids())
  );

CREATE POLICY "budgets_insert" ON budgets
  FOR INSERT WITH CHECK (
    group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
    AND created_by = (SELECT get_my_person_id())
  );

-- Owning-group treasurer manages; approver-group treasurer approves/ratifies.
-- Column-level separation (who may flip which status) is enforced in actions.
CREATE POLICY "budgets_update" ON budgets
  FOR UPDATE USING (
    group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
    OR COALESCE(approver_group_id, group_id) IN (SELECT get_my_module_admin_group_ids('treasurer'))
  );

CREATE POLICY "budgets_delete" ON budgets
  FOR DELETE USING (group_id IN (SELECT get_my_module_admin_group_ids('treasurer')));

CREATE TRIGGER budgets_audit
  AFTER UPDATE OR DELETE ON budgets
  FOR EACH ROW EXECUTE FUNCTION log_data_change();

-- ── budget_proposals ─────────────────────────────────────────────────────────

CREATE TABLE budget_proposals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id    uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  position_id  uuid REFERENCES positions(id) ON DELETE SET NULL,
  subgroup_id  uuid REFERENCES subgroups(id) ON DELETE SET NULL,
  submitted_by uuid NOT NULL REFERENCES persons(id),
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'submitted', 'returned')),
  submitted_at timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- At most one owner axis; both null = the budget's general proposal
  CHECK (position_id IS NULL OR subgroup_id IS NULL)
);

-- Uniqueness must be partial: plain UNIQUE treats NULLs as distinct
CREATE UNIQUE INDEX idx_budget_proposals_position
  ON budget_proposals (budget_id, position_id) WHERE position_id IS NOT NULL;
CREATE UNIQUE INDEX idx_budget_proposals_subgroup
  ON budget_proposals (budget_id, subgroup_id) WHERE subgroup_id IS NOT NULL;
CREATE UNIQUE INDEX idx_budget_proposals_general
  ON budget_proposals (budget_id) WHERE position_id IS NULL AND subgroup_id IS NULL;

ALTER TABLE budget_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_proposals_select" ON budget_proposals
  FOR SELECT USING (
    budget_id IN (
      SELECT id FROM budgets
      WHERE group_id IN (SELECT get_my_group_ids())
         OR approver_group_id IN (SELECT get_my_group_ids())
    )
  );

-- Treasurer of the owning group, or the position's current holder while the
-- budget is still drafting
CREATE POLICY "budget_proposals_insert" ON budget_proposals
  FOR INSERT WITH CHECK (
    budget_id IN (
      SELECT id FROM budgets WHERE group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
    )
    OR (
      position_id IN (SELECT get_my_position_ids())
      AND budget_id IN (SELECT id FROM budgets WHERE status = 'drafting')
    )
  );

CREATE POLICY "budget_proposals_update" ON budget_proposals
  FOR UPDATE USING (
    budget_id IN (
      SELECT id FROM budgets WHERE group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
    )
    OR (
      position_id IN (SELECT get_my_position_ids())
      AND status = 'draft'
      AND budget_id IN (SELECT id FROM budgets WHERE status = 'drafting')
    )
  );

CREATE POLICY "budget_proposals_delete" ON budget_proposals
  FOR DELETE USING (
    budget_id IN (
      SELECT id FROM budgets WHERE group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
    )
  );

CREATE TRIGGER budget_proposals_audit
  AFTER UPDATE OR DELETE ON budget_proposals
  FOR EACH ROW EXECUTE FUNCTION log_data_change();

-- ── budget_line_items ────────────────────────────────────────────────────────

CREATE TABLE budget_line_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid NOT NULL REFERENCES budget_proposals(id) ON DELETE CASCADE,
  description   text NOT NULL,
  amount        numeric(10, 2) NOT NULL CHECK (amount >= 0),
  category      text,
  notes         text,
  display_order int,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_line_items_proposal ON budget_line_items(proposal_id);

ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_line_items_select" ON budget_line_items
  FOR SELECT USING (
    proposal_id IN (
      SELECT p.id FROM budget_proposals p
      JOIN budgets b ON b.id = p.budget_id
      WHERE b.group_id IN (SELECT get_my_group_ids())
         OR b.approver_group_id IN (SELECT get_my_group_ids())
    )
  );

CREATE POLICY "budget_line_items_insert" ON budget_line_items
  FOR INSERT WITH CHECK (
    proposal_id IN (
      SELECT p.id FROM budget_proposals p
      JOIN budgets b ON b.id = p.budget_id
      WHERE b.group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
         OR (p.position_id IN (SELECT get_my_position_ids())
             AND p.status = 'draft' AND b.status = 'drafting')
    )
  );

CREATE POLICY "budget_line_items_update" ON budget_line_items
  FOR UPDATE USING (
    proposal_id IN (
      SELECT p.id FROM budget_proposals p
      JOIN budgets b ON b.id = p.budget_id
      WHERE b.group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
         OR (p.position_id IN (SELECT get_my_position_ids())
             AND p.status = 'draft' AND b.status = 'drafting')
    )
  );

CREATE POLICY "budget_line_items_delete" ON budget_line_items
  FOR DELETE USING (
    proposal_id IN (
      SELECT p.id FROM budget_proposals p
      JOIN budgets b ON b.id = p.budget_id
      WHERE b.group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
         OR (p.position_id IN (SELECT get_my_position_ids())
             AND p.status = 'draft' AND b.status = 'drafting')
    )
  );

CREATE TRIGGER budget_line_items_audit
  AFTER UPDATE OR DELETE ON budget_line_items
  FOR EACH ROW EXECUTE FUNCTION log_data_change();

-- ── reimbursements ───────────────────────────────────────────────────────────

CREATE TABLE reimbursements (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id                  uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  term_id                   uuid REFERENCES terms(id) ON DELETE SET NULL,
  submitted_by              uuid NOT NULL REFERENCES persons(id),
  amount                    numeric(10, 2) NOT NULL CHECK (amount > 0),
  description               text NOT NULL,
  occurred_on               date NOT NULL,
  receipt_paths             text[],
  proposal_id               uuid REFERENCES budget_proposals(id) ON DELETE SET NULL,
  line_item_id              uuid REFERENCES budget_line_items(id) ON DELETE SET NULL,
  status                    text NOT NULL DEFAULT 'submitted'
                            CHECK (status IN ('submitted', 'approved', 'rejected', 'reimbursed', 'credited')),
  approved_by               uuid REFERENCES persons(id) ON DELETE SET NULL,
  approved_at               timestamptz,
  resolved_by               uuid REFERENCES persons(id) ON DELETE SET NULL,
  resolved_at               timestamptz,
  resolution_note           text,
  applied_progress_entry_id uuid REFERENCES requirement_progress_entries(id) ON DELETE SET NULL,
  external_ref              text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reimbursements_group ON reimbursements(group_id, status);
CREATE INDEX idx_reimbursements_submitter ON reimbursements(submitted_by);
CREATE INDEX idx_reimbursements_proposal ON reimbursements(proposal_id);

ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;

-- Own rows; treasurer sees all; the area officer sees ones routed to their
-- proposal's position
CREATE POLICY "reimbursements_select" ON reimbursements
  FOR SELECT USING (
    submitted_by = (SELECT get_my_person_id())
    OR group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
    OR proposal_id IN (
      SELECT id FROM budget_proposals WHERE position_id IN (SELECT get_my_position_ids())
    )
  );

CREATE POLICY "reimbursements_insert" ON reimbursements
  FOR INSERT WITH CHECK (
    submitted_by = (SELECT get_my_person_id())
    AND group_id IN (SELECT get_my_group_ids())
  );

-- Area officer approves; treasurer resolves. Stage rules enforced in actions.
CREATE POLICY "reimbursements_update" ON reimbursements
  FOR UPDATE USING (
    group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
    OR proposal_id IN (
      SELECT id FROM budget_proposals WHERE position_id IN (SELECT get_my_position_ids())
    )
  );

-- Submitter may withdraw while still unreviewed; treasurer may clean up
CREATE POLICY "reimbursements_delete" ON reimbursements
  FOR DELETE USING (
    (submitted_by = (SELECT get_my_person_id()) AND status = 'submitted')
    OR group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
  );

CREATE TRIGGER reimbursements_audit
  AFTER UPDATE OR DELETE ON reimbursements
  FOR EACH ROW EXECUTE FUNCTION log_data_change();

-- ── receipts storage bucket (authenticated-only) ─────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false);

CREATE POLICY "receipts_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = (SELECT get_my_person_id())::text
  );

CREATE POLICY "receipts_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = (SELECT get_my_person_id())::text
  );

CREATE POLICY "receipts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

-- ── comments: budgets become a commentable surface ───────────────────────────

ALTER TABLE comments DROP CONSTRAINT comments_resource_type_check;
ALTER TABLE comments ADD CONSTRAINT comments_resource_type_check CHECK (
  resource_type IN ('document', 'poll', 'requirement', 'budget')
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
      -- Both the owning group and the approver group may discuss
      RETURN EXISTS (
        SELECT 1 FROM budgets b
        WHERE b.id = p_resource_id
          AND (b.group_id IN (SELECT get_my_group_ids())
               OR b.approver_group_id IN (SELECT get_my_group_ids()))
      );
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- ── grants ───────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON budgets, budget_proposals, budget_line_items, reimbursements TO authenticated;
GRANT ALL ON budgets, budget_proposals, budget_line_items, reimbursements TO service_role;
