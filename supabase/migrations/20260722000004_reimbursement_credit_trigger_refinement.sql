-- ============================================================================
-- Refine enforce_reimbursement_transition() for the race-safe credit flow.
--
-- Applying a credit is three PostgREST calls (no transaction): (1) CAS-flip
-- approved → credited, which is what makes a concurrent double-credit
-- impossible; (2) insert the requirement_progress_entry; (3) attach the entry
-- id to the reimbursement. Step 3 is a same-status update of a resolved row,
-- and a failed step 2 needs a treasurer-only rollback credited → approved
-- while no entry is attached. The 20260722000003 trigger allowed neither.
-- ============================================================================

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

  is_treasurer :=
    OLD.group_id IN (SELECT get_my_module_admin_group_ids('treasurer'));

  IF NEW.status = OLD.status THEN
    -- Attaching the credit's progress entry is the one legal edit to a
    -- resolved row (treasurer, credited, entry not yet linked)
    IF OLD.status = 'credited'
       AND is_treasurer
       AND OLD.applied_progress_entry_id IS NULL
       AND NEW.applied_progress_entry_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    IF OLD.status IN ('rejected', 'reimbursed', 'credited') THEN
      RAISE EXCEPTION 'This reimbursement is resolved and read-only';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'submitted' AND NEW.status IN ('approved', 'rejected') THEN
    RETURN NEW; -- area officer or treasurer, per the update policy
  END IF;

  IF OLD.status = 'approved' AND NEW.status IN ('reimbursed', 'credited', 'rejected') THEN
    IF NOT is_treasurer THEN
      RAISE EXCEPTION 'Only a treasurer can resolve an approved reimbursement';
    END IF;
    RETURN NEW;
  END IF;

  -- Rolling back a credit whose progress entry failed to create: the flip
  -- happened but nothing was ever credited, so the treasurer may retry
  IF OLD.status = 'credited' AND NEW.status = 'approved'
     AND OLD.applied_progress_entry_id IS NULL THEN
    IF NOT is_treasurer THEN
      RAISE EXCEPTION 'Only a treasurer can revert a credit';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid reimbursement status change (% → %)', OLD.status, NEW.status;
END;
$$;
