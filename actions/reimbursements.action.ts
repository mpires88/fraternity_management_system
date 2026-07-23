'use server'

import {
  createNoInputOrgQueryAction,
  createOrgQueryAction,
  createValidatedOrgAction,
} from '@/actions/utils/action-helpers'
import { getTreasurerPersonIdsDal } from '@/dal/positions'
import type { ReimbursementWithDetails } from '@/dal/reimbursements'
import {
  approveReimbursementDal,
  createReimbursementDal,
  getCreditTargetAssignmentDal,
  getLineItemsForProposalDal,
  getPaymentAssignmentsForPersonDal,
  getPersonNameDal,
  getProposalPositionHoldersDal,
  getProposalsForPickerDal,
  getReimbursementByIdDal,
  getReimbursementOwnerDal,
  getReimbursementsForGroupDal,
  lineItemBelongsToProposalDal,
  linkCreditEntryDal,
  markCreditedReimbursementDal,
  reimburseReimbursementDal,
  rejectReimbursementDal,
  resolveReceiptUrlsDal,
  revertCreditReimbursementDal,
  withdrawReimbursementDal,
} from '@/dal/reimbursements'
import { createProgressEntryDal } from '@/dal/requirements'
import type { DbClient } from '@/dal/types'
import { UserFacingError } from '@/lib/errors'
import {
  notifyReimbursementResolved,
  notifyReimbursementSubmitted,
  notifyReimbursementToTreasurer,
} from '@/lib/notifications/triggers'
import {
  applyCreditSchema,
  approveReimbursementSchema,
  reimburseSchema,
  rejectReimbursementSchema,
  submitReimbursementSchema,
  withdrawReimbursementSchema,
} from '@/lib/validations/reimbursement'

/**
 * Resolve = treasurer-only. The DB trigger enforces this too
 * (enforce_reimbursement_transition); this check exists to give a clear
 * error before any write is attempted.
 */
async function assertTreasurer(supabase: DbClient, groupId: string): Promise<void> {
  const { data } = await supabase.rpc('get_my_module_admin_group_ids', { p_module: 'treasurer' })
  if (!((data as string[] | null) ?? []).includes(groupId)) {
    throw new UserFacingError('Only a treasurer can do this')
  }
}

/** Every mutation targets a row in the CURRENT group — a treasurer of two
 * groups must not act on group B's rows from group A's context. */
function assertSameGroup(ownerGroupId: string, groupId: string): void {
  if (ownerGroupId !== groupId) {
    throw new UserFacingError('This reimbursement belongs to a different group')
  }
}

// ── Queries ────────────────────────────────────────────────────────────────

export const getReimbursements = createOrgQueryAction<
  { termId?: string },
  ReimbursementWithDetails[]
>(async (supabase, _actor, groupId, input) => {
  return getReimbursementsForGroupDal(supabase, groupId, input.termId)
})

export const getReimbursementDetail = createOrgQueryAction<
  { id: string },
  ReimbursementWithDetails
>(async (supabase, _actor, _groupId, input) => {
  const row = await getReimbursementByIdDal(supabase, input.id)
  if (!row) throw new UserFacingError('Reimbursement not found')
  return row
})

export const getProposalsForPicker = createNoInputOrgQueryAction<
  Array<{ id: string; budget_title: string; label: string }>
>(async (supabase, _actor, groupId) => {
  return getProposalsForPickerDal(supabase, groupId)
})

/** Signed URLs for a reimbursement's receipts (RLS scopes who can sign). */
export const getReceiptUrls = createOrgQueryAction<{ paths: string[] }, Record<string, string>>(
  async (supabase, _actor, _groupId, input) => {
    return resolveReceiptUrlsDal(supabase, input.paths.slice(0, 10))
  }
)

/** Credit targets for one submitter: their incomplete payment assignments. */
export const getCreditTargetsForPerson = createOrgQueryAction<
  { personId: string },
  Array<{ id: string; title: string }>
>(async (supabase, _actor, groupId, input) => {
  return getPaymentAssignmentsForPersonDal(supabase, groupId, input.personId)
})

/** Line items of a proposal — options for pinning at approval. */
export const getProposalLineItems = createOrgQueryAction<
  { proposalId: string },
  Array<{ id: string; description: string; amount: number }>
>(async (supabase, _actor, _groupId, input) => {
  return getLineItemsForProposalDal(supabase, input.proposalId)
})

// ── Submit (any member) ────────────────────────────────────────────────────

export const submitReimbursement = createValidatedOrgAction(
  submitReimbursementSchema,
  async (supabase, actor, groupId, input) => {
    const id = await createReimbursementDal(supabase, groupId, actor.personId, input)

    try {
      const name = await getPersonNameDal(supabase, actor.personId)
      const holders = input.proposal_id
        ? await getProposalPositionHoldersDal(supabase, input.proposal_id, groupId)
        : []
      const audience =
        holders.length > 0 ? holders : await getTreasurerPersonIdsDal(supabase, groupId)
      if (audience.length > 0) {
        await notifyReimbursementSubmitted(supabase, groupId, name, '/reimbursements', audience)
      }
    } catch {
      // Notifications are best-effort
    }

    return id
  },
  { revalidatePaths: ['/reimbursements'] }
)

// ── Approve (area officer or treasurer) ────────────────────────────────────

export const approveReimbursement = createValidatedOrgAction(
  approveReimbursementSchema,
  async (supabase, actor, groupId, input) => {
    const owner = await getReimbursementOwnerDal(supabase, input.id)
    if (!owner) throw new UserFacingError('Reimbursement not found')
    assertSameGroup(owner.group_id, groupId)
    if (owner.status !== 'submitted')
      throw new UserFacingError('Only submitted reimbursements can be approved')

    // A pinned line item must belong to the request's own budget area
    if (input.line_item_id) {
      if (!owner.proposal_id)
        throw new UserFacingError('This request has no budget area to pin a line item from')
      const belongs = await lineItemBelongsToProposalDal(
        supabase,
        input.line_item_id,
        owner.proposal_id
      )
      if (!belongs)
        throw new UserFacingError("The chosen line item is not part of this request's budget area")
    }

    const result = await approveReimbursementDal(
      supabase,
      input.id,
      actor.personId,
      input.line_item_id
    )
    if (!result.success) throw new UserFacingError(result.error ?? 'Approve failed')

    try {
      const submitterName = await getPersonNameDal(supabase, owner.submitted_by)
      const treasurerIds = await getTreasurerPersonIdsDal(supabase, groupId)
      if (treasurerIds.length > 0) {
        await notifyReimbursementToTreasurer(
          supabase,
          groupId,
          submitterName,
          '/reimbursements',
          treasurerIds
        )
      }
    } catch {
      // Notifications are best-effort
    }
  },
  { revalidatePaths: ['/reimbursements'] }
)

// ── Reject (officer while submitted; treasurer at either stage) ────────────

export const rejectReimbursement = createValidatedOrgAction(
  rejectReimbursementSchema,
  async (supabase, actor, groupId, input) => {
    const owner = await getReimbursementOwnerDal(supabase, input.id)
    if (!owner) throw new UserFacingError('Reimbursement not found')
    assertSameGroup(owner.group_id, groupId)
    if (!['submitted', 'approved'].includes(owner.status))
      throw new UserFacingError('Cannot reject a resolved reimbursement')
    // Rejecting an already-approved request is a resolve step — treasurer only
    if (owner.status === 'approved') await assertTreasurer(supabase, groupId)

    const result = await rejectReimbursementDal(supabase, input.id, actor.personId, input.note)
    if (!result.success) throw new UserFacingError(result.error ?? 'Reject failed')

    try {
      await notifyReimbursementResolved(
        supabase,
        groupId,
        'rejected',
        '/reimbursements',
        owner.submitted_by
      )
    } catch {
      // Notifications are best-effort
    }
  },
  { revalidatePaths: ['/reimbursements'] }
)

// ── Reimburse / pay out (treasurer) ────────────────────────────────────────

export const reimburse = createValidatedOrgAction(
  reimburseSchema,
  async (supabase, actor, groupId, input) => {
    const owner = await getReimbursementOwnerDal(supabase, input.id)
    if (!owner) throw new UserFacingError('Reimbursement not found')
    assertSameGroup(owner.group_id, groupId)
    await assertTreasurer(supabase, groupId)
    if (owner.status !== 'approved')
      throw new UserFacingError('Only approved reimbursements can be paid out')

    const result = await reimburseReimbursementDal(
      supabase,
      input.id,
      actor.personId,
      input.note,
      input.external_ref
    )
    if (!result.success) throw new UserFacingError(result.error ?? 'Reimburse failed')

    try {
      await notifyReimbursementResolved(
        supabase,
        groupId,
        'reimbursed',
        '/reimbursements',
        owner.submitted_by
      )
    } catch {
      // Notifications are best-effort
    }
  },
  { revalidatePaths: ['/reimbursements'] }
)

// ── Apply as credit (treasurer) ────────────────────────────────────────────

export const applyCredit = createValidatedOrgAction(
  applyCreditSchema,
  async (supabase, actor, groupId, input) => {
    const owner = await getReimbursementOwnerDal(supabase, input.id)
    if (!owner) throw new UserFacingError('Reimbursement not found')
    assertSameGroup(owner.group_id, groupId)
    await assertTreasurer(supabase, groupId)
    if (owner.status !== 'approved')
      throw new UserFacingError('Only approved reimbursements can be credited')

    const reimb = await getReimbursementByIdDal(supabase, input.id)
    if (!reimb) throw new UserFacingError('Reimbursement not found')

    // The credit must land on the SUBMITTER's own payment obligation in this
    // group — a wrong target credits someone else's dues
    const target = await getCreditTargetAssignmentDal(supabase, input.assignment_id)
    if (!target) throw new UserFacingError('Payment assignment not found')
    if (target.group_id !== groupId)
      throw new UserFacingError('That assignment belongs to a different group')
    if (target.person_id !== owner.submitted_by)
      throw new UserFacingError("The credit must go to the submitter's own payment assignment")
    if (target.kind !== 'payment')
      throw new UserFacingError('Credits can only be applied to payment requirements')

    // Flip status FIRST (compare-and-set on 'approved'): a concurrent second
    // click loses the CAS and no duplicate credit entry is ever created
    const flip = await markCreditedReimbursementDal(supabase, input.id, actor.personId, input.note)
    if (!flip.success) throw new UserFacingError(flip.error ?? 'Credit failed')

    // Progress amounts are integer cents; round to avoid 19.99*100 = 1998.99…
    const amountCents = Math.round(reimb.amount * 100)
    let entryId: string
    try {
      entryId = await createProgressEntryDal(supabase, {
        assignmentId: input.assignment_id,
        amount: amountCents,
        occurredOn: reimb.occurred_on,
        note: `Reimbursement credit: ${reimb.description} (${input.id})`,
        loggedBy: actor.personId,
        approvedBy: actor.personId,
      })
    } catch (err) {
      // Nothing was credited — roll the status back so the treasurer can retry
      await revertCreditReimbursementDal(supabase, input.id)
      throw err
    }

    await linkCreditEntryDal(supabase, input.id, entryId)

    try {
      await notifyReimbursementResolved(
        supabase,
        groupId,
        'credited',
        '/reimbursements',
        owner.submitted_by
      )
    } catch {
      // Notifications are best-effort
    }
  },
  { revalidatePaths: ['/reimbursements'] }
)

// ── Withdraw (submitter only, while still submitted) ───────────────────────

export const withdrawReimbursement = createValidatedOrgAction(
  withdrawReimbursementSchema,
  async (supabase, actor, _groupId, input) => {
    const owner = await getReimbursementOwnerDal(supabase, input.id)
    if (!owner) throw new UserFacingError('Reimbursement not found')
    if (owner.submitted_by !== actor.personId)
      throw new UserFacingError('You can only withdraw your own requests')
    if (owner.status !== 'submitted')
      throw new UserFacingError('Only pending requests can be withdrawn')

    const result = await withdrawReimbursementDal(supabase, input.id)
    if (!result.success) throw new UserFacingError(result.error ?? 'Withdraw failed')
  },
  { revalidatePaths: ['/reimbursements'] }
)
