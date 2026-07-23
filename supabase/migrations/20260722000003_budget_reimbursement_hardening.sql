-- ============================================================================
-- Phase 11 review hardening: close the RLS holes found in the 2026-07-22
-- review of budgets + reimbursements.
--
-- 1. budget_proposals UPDATE relied on USING-as-implicit-WITH-CHECK, so a
--    holder's draft→submitted flip failed RLS (the new row is no longer
--    'draft') — only treasurers could submit. Explicit WITH CHECK fixes it.
-- 2. 'returned' proposals were a dead end: every holder policy required
--    status = 'draft', so a returned proposal could never be revised or
--    resubmitted. Holder branches now accept 'draft' AND 'returned'.
-- 3. Status-flip authority was deferred to actions ("column-level separation
--    is enforced in actions") — but actions are not a security boundary; the
--    PostgREST API is client-reachable. BEFORE UPDATE triggers now enforce
--    who may perform which lifecycle transition (approve/ratify = the
--    APPROVER group's treasurer; vote-mode ratification is service-role only,
--    driven by the poll-close action after the supermajority check).
-- 4. Ratified/archived budgets are frozen (a treasurer could previously edit
--    line items on a ratified budget); treasurer proposal/line-item writes
--    are now lifecycle-gated to drafting/in_review.
-- 5. receipts SELECT was bucket-wide for any authenticated user platform-wide;
--    now: own folder, or treasurer / area officer of a reimbursement the
--    receipt is attached to. Bucket gains size + MIME limits.
-- 6. Reimbursement core fields (amount, submitter, receipts, routing) are
--    frozen after insert; resolve transitions are treasurer-only at the DB.
-- ============================================================================

-- ── budget_proposals: explicit WITH CHECK + returned-proposal path ───────────

DROP POLICY "budget_proposals_insert" ON budget_proposals;
CREATE POLICY "budget_proposals_insert" ON budget_proposals
  FOR INSERT WITH CHECK (
    budget_id IN (
      SELECT id FROM budgets
      WHERE group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
        AND status = 'drafting'
    )
    OR (
      position_id IN (SELECT get_my_position_ids())
      AND submitted_by = (SELECT get_my_person_id())
      -- The position must belong to the budget's own group (a holder in group
      -- A must not attach their position to group B's budget)
      AND EXISTS (
        SELECT 1
        FROM budgets b
        JOIN positions pos ON pos.id = budget_proposals.position_id
        WHERE b.id = budget_proposals.budget_id
          AND b.status = 'drafting'
          AND pos.group_id = b.group_id
      )
    )
  );

DROP POLICY "budget_proposals_update" ON budget_proposals;
CREATE POLICY "budget_proposals_update" ON budget_proposals
  FOR UPDATE USING (
    budget_id IN (
      SELECT id FROM budgets
      WHERE group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
        AND status IN ('drafting', 'in_review')
    )
    OR (
      position_id IN (SELECT get_my_position_ids())
      AND status IN ('draft', 'returned')
      AND budget_id IN (SELECT id FROM budgets WHERE status = 'drafting')
    )
  )
  WITH CHECK (
    budget_id IN (
      SELECT id FROM budgets
      WHERE group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
        AND status IN ('drafting', 'in_review')
    )
    OR (
      position_id IN (SELECT get_my_position_ids())
      -- Holders may keep editing (draft) or submit; only the treasurer sets
      -- 'returned'
      AND status IN ('draft', 'submitted')
      AND budget_id IN (SELECT id FROM budgets WHERE status = 'drafting')
    )
  );

DROP POLICY "budget_proposals_delete" ON budget_proposals;
CREATE POLICY "budget_proposals_delete" ON budget_proposals
  FOR DELETE USING (
    budget_id IN (
      SELECT id FROM budgets
      WHERE group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
        AND status IN ('drafting', 'in_review')
    )
  );

-- ── budget_line_items: lifecycle gates on the treasurer branch too ───────────

DROP POLICY "budget_line_items_insert" ON budget_line_items;
CREATE POLICY "budget_line_items_insert" ON budget_line_items
  FOR INSERT WITH CHECK (
    proposal_id IN (
      SELECT p.id FROM budget_proposals p
      JOIN budgets b ON b.id = p.budget_id
      WHERE (b.group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
             AND b.status IN ('drafting', 'in_review'))
         OR (p.position_id IN (SELECT get_my_position_ids())
             AND p.status IN ('draft', 'returned') AND b.status = 'drafting')
    )
  );

DROP POLICY "budget_line_items_update" ON budget_line_items;
CREATE POLICY "budget_line_items_update" ON budget_line_items
  FOR UPDATE USING (
    proposal_id IN (
      SELECT p.id FROM budget_proposals p
      JOIN budgets b ON b.id = p.budget_id
      WHERE (b.group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
             AND b.status IN ('drafting', 'in_review'))
         OR (p.position_id IN (SELECT get_my_position_ids())
             AND p.status IN ('draft', 'returned') AND b.status = 'drafting')
    )
  )
  WITH CHECK (
    proposal_id IN (
      SELECT p.id FROM budget_proposals p
      JOIN budgets b ON b.id = p.budget_id
      WHERE (b.group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
             AND b.status IN ('drafting', 'in_review'))
         OR (p.position_id IN (SELECT get_my_position_ids())
             AND p.status IN ('draft', 'returned') AND b.status = 'drafting')
    )
  );

DROP POLICY "budget_line_items_delete" ON budget_line_items;
CREATE POLICY "budget_line_items_delete" ON budget_line_items
  FOR DELETE USING (
    proposal_id IN (
      SELECT p.id FROM budget_proposals p
      JOIN budgets b ON b.id = p.budget_id
      WHERE (b.group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
             AND b.status IN ('drafting', 'in_review'))
         OR (p.position_id IN (SELECT get_my_position_ids())
             AND p.status IN ('draft', 'returned') AND b.status = 'drafting')
    )
  );

-- ── budgets: lifecycle-transition enforcement at the DB ──────────────────────
-- RLS (row-level, both treasurer sets) stays as-is; WHO may flip WHICH status
-- cannot be expressed in a policy (WITH CHECK can't see the old row), so a
-- BEFORE UPDATE trigger carries the transition matrix. Service-role writes
-- (poll-close ratification, after the supermajority check in the action)
-- bypass it via the auth.uid() IS NULL early return.

CREATE OR REPLACE FUNCTION enforce_budget_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_owning_treasurer   boolean;
  is_approver_treasurer boolean;
BEGIN
  -- Service role / server-side jobs: the app-level gate is the boundary
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.group_id <> OLD.group_id THEN
    RAISE EXCEPTION 'A budget cannot move to another group';
  END IF;

  IF NEW.status = OLD.status THEN
    IF OLD.status IN ('ratified', 'archived') THEN
      RAISE EXCEPTION 'This budget is finalized and read-only';
    END IF;
    -- Title/term and the approval routing are load-bearing for who may
    -- approve — frozen once the budget leaves drafting
    IF OLD.status <> 'drafting' AND (
      NEW.title <> OLD.title
      OR NEW.term_id <> OLD.term_id
      OR NEW.approval_mode <> OLD.approval_mode
      OR NEW.approver_group_id IS DISTINCT FROM OLD.approver_group_id
      OR NEW.approver_position_id IS DISTINCT FROM OLD.approver_position_id
    ) THEN
      RAISE EXCEPTION 'Title, term and approver settings are locked after drafting';
    END IF;
    RETURN NEW;
  END IF;

  is_owning_treasurer :=
    OLD.group_id IN (SELECT get_my_module_admin_group_ids('treasurer'));
  is_approver_treasurer :=
    COALESCE(OLD.approver_group_id, OLD.group_id)
      IN (SELECT get_my_module_admin_group_ids('treasurer'));

  IF OLD.status = 'drafting' AND NEW.status = 'in_review' THEN
    IF NOT is_owning_treasurer THEN
      RAISE EXCEPTION 'Only the owning group''s treasurer can compile a budget';
    END IF;
  ELSIF OLD.status = 'in_review' AND NEW.status = 'drafting' THEN
    IF NOT (is_owning_treasurer OR is_approver_treasurer) THEN
      RAISE EXCEPTION 'Only a treasurer can return a budget to drafting';
    END IF;
  ELSIF OLD.status = 'in_review' AND NEW.status = 'approved' THEN
    IF OLD.approval_mode = 'vote' THEN
      RAISE EXCEPTION 'A vote-mode budget is ratified by its poll, not approved';
    END IF;
    IF NOT is_approver_treasurer THEN
      RAISE EXCEPTION 'Only the approving group''s treasurer can approve this budget';
    END IF;
  ELSIF OLD.status = 'approved' AND NEW.status = 'ratified' THEN
    -- Poll-driven modes ratify exclusively through the poll-close path
    -- (service role, after the supermajority result is verified)
    IF OLD.approval_mode <> 'approver' THEN
      RAISE EXCEPTION 'This budget is ratified by its ratification vote';
    END IF;
    IF NOT is_approver_treasurer THEN
      RAISE EXCEPTION 'Only the approving group''s treasurer can ratify this budget';
    END IF;
  ELSIF NEW.status = 'archived' THEN
    IF NOT is_owning_treasurer THEN
      RAISE EXCEPTION 'Only the owning group''s treasurer can archive a budget';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid budget status change (% → %)', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER budgets_enforce_transition
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION enforce_budget_transition();

-- ── reimbursements: transition + core-field enforcement at the DB ────────────
-- The update policy admits both the area officer and the treasurer; this
-- trigger enforces the stage rules the old in-file comment deferred to
-- actions: resolve (reimbursed/credited, or rejecting an approved claim) is
-- treasurer-only, and the financial substance of a claim is immutable after
-- submission.

CREATE OR REPLACE FUNCTION enforce_reimbursement_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_treasurer boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.group_id <> OLD.group_id
     OR NEW.submitted_by <> OLD.submitted_by
     OR NEW.amount <> OLD.amount
     OR NEW.description <> OLD.description
     OR NEW.occurred_on <> OLD.occurred_on
     OR NEW.receipt_paths IS DISTINCT FROM OLD.receipt_paths
     OR NEW.proposal_id IS DISTINCT FROM OLD.proposal_id THEN
    RAISE EXCEPTION 'A submitted reimbursement request cannot be altered — reject it and ask for a new one';
  END IF;

  IF NEW.status = OLD.status THEN
    IF OLD.status IN ('rejected', 'reimbursed', 'credited') THEN
      RAISE EXCEPTION 'This reimbursement is resolved and read-only';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'submitted' AND NEW.status IN ('approved', 'rejected') THEN
    RETURN NEW; -- area officer or treasurer, per the update policy
  END IF;

  IF OLD.status = 'approved' AND NEW.status IN ('reimbursed', 'credited', 'rejected') THEN
    is_treasurer :=
      OLD.group_id IN (SELECT get_my_module_admin_group_ids('treasurer'));
    IF NOT is_treasurer THEN
      RAISE EXCEPTION 'Only a treasurer can resolve an approved reimbursement';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid reimbursement status change (% → %)', OLD.status, NEW.status;
END;
$$;

CREATE TRIGGER reimbursements_enforce_transition
  BEFORE UPDATE ON reimbursements
  FOR EACH ROW EXECUTE FUNCTION enforce_reimbursement_transition();

-- ── receipts: scope reads to the people in the flow ──────────────────────────

DROP POLICY "receipts_select" ON storage.objects;
CREATE POLICY "receipts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      -- Own uploads
      (storage.foldername(name))[1] = (SELECT get_my_person_id())::text
      -- Treasurer of, or area officer for, a reimbursement this receipt is
      -- attached to
      OR EXISTS (
        SELECT 1 FROM reimbursements r
        WHERE name = ANY (r.receipt_paths)
          AND (
            r.group_id IN (SELECT get_my_module_admin_group_ids('treasurer'))
            OR r.proposal_id IN (
              SELECT id FROM budget_proposals
              WHERE position_id IN (SELECT get_my_position_ids())
            )
          )
      )
    )
  );

UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'
    ]
WHERE id = 'receipts';
