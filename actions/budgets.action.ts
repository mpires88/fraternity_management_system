'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createOrgQueryAction, createValidatedOrgAction } from '@/actions/utils/action-helpers'
import type { BudgetRow, BudgetWithProposals } from '@/dal/budgets'
import {
  approveBudgetDal,
  archiveBudgetDal,
  compileBudgetDal,
  createBudgetDal,
  createLineItemDal,
  createProposalDal,
  deleteBudgetDal,
  deleteLineItemDal,
  deleteProposalDal,
  getBudgetDetailDal,
  getBudgetsForGroupDal,
  getProposalOwnerDal,
  linkPollToBudgetDal,
  ratifyBudgetDal,
  returnBudgetToDraftDal,
  returnProposalDal,
  submitProposalDal,
  updateBudgetDal,
  updateLineItemDal,
  updateProposalDal,
} from '@/dal/budgets'
import { getActiveMemberPersonIdsDal } from '@/dal/members'
import { addParticipantsDal, createPollDal, publishPollDal } from '@/dal/polls'
import { getTreasurerPersonIdsDal } from '@/dal/positions'
import type { DbClient } from '@/dal/types'
import { UserFacingError } from '@/lib/errors'
import {
  notifyBudgetProposalSubmitted,
  notifyBudgetRatified,
  notifyBudgetReturned,
} from '@/lib/notifications/triggers'
import type { Database } from '@/lib/supabase/types'
import type { ApprovalMode, BudgetStatus } from '@/lib/utils/budgets'
import { canCompile, canCreateRatificationPoll, canManuallyRatify } from '@/lib/utils/budgets'
import {
  approveBudgetSchema,
  archiveBudgetSchema,
  compileBudgetSchema,
  createBudgetSchema,
  createLineItemSchema,
  createProposalSchema,
  createRatificationPollSchema,
  deleteBudgetSchema,
  deleteLineItemSchema,
  deleteProposalSchema,
  ratifyBudgetSchema,
  returnBudgetToDraftSchema,
  returnProposalSchema,
  submitProposalSchema,
  updateBudgetSchema,
  updateLineItemSchema,
  updateProposalSchema,
} from '@/lib/validations/budget'

/**
 * Approve/ratify are gated on the APPROVER group's treasurer (the whole point
 * of cross-group approval — SNHC signs off on the house bill, the chapter
 * cannot self-approve). The DB trigger enforce_budget_transition() enforces
 * the same matrix; this check exists for a clear error before the write.
 */
async function assertApproverTreasurer(
  supabase: DbClient,
  budget: { group_id: string; approver_group_id: string | null }
): Promise<void> {
  const approverGroupId = budget.approver_group_id ?? budget.group_id
  const { data } = await supabase.rpc('get_my_module_admin_group_ids', { p_module: 'treasurer' })
  if (!((data as string[] | null) ?? []).includes(approverGroupId)) {
    throw new UserFacingError("Only the approving group's treasurer can do this")
  }
}

/**
 * Ratification polls live in the APPROVER group, whose poll-insert policies
 * require that group's full admins — but the vote is legitimately started by
 * a treasurer who may not be one. Poll rows are therefore created through the
 * service role AFTER assertApproverTreasurer has verified the gate (exactly
 * the bid-vote pattern in recruitment.action.ts). RLS cannot protect a
 * service-role write; the app-level gate is the boundary.
 */
function serviceRoleClient(): DbClient {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Budget queries ─────────────────────────────────────────────────────────

export const getBudgets = createOrgQueryAction<{ termId?: string }, BudgetRow[]>(
  async (supabase, _actor, groupId, input) => {
    return getBudgetsForGroupDal(supabase, groupId, input.termId)
  }
)

export const getBudgetDetail = createOrgQueryAction<{ budgetId: string }, BudgetWithProposals>(
  async (supabase, _actor, _groupId, input) => {
    return getBudgetDetailDal(supabase, input.budgetId)
  }
)

// ── Budget mutations ───────────────────────────────────────────────────────

export const createBudget = createValidatedOrgAction(
  createBudgetSchema,
  async (supabase, actor, groupId, input) => {
    return createBudgetDal(supabase, groupId, actor.personId, input)
  },
  { revalidatePaths: ['/budget'] }
)

export const updateBudget = createValidatedOrgAction(
  updateBudgetSchema,
  async (supabase, _actor, _groupId, input) => {
    const { id, ...updates } = input
    const result = await updateBudgetDal(supabase, id, updates)
    if (!result.success) throw new UserFacingError(result.error ?? 'Operation failed')
  },
  { revalidatePaths: ['/budget'] }
)

export const deleteBudget = createValidatedOrgAction(
  deleteBudgetSchema,
  async (supabase, _actor, _groupId, input) => {
    const result = await deleteBudgetDal(supabase, input.id)
    if (!result.success) throw new UserFacingError(result.error ?? 'Operation failed')
  },
  { revalidatePaths: ['/budget'] }
)

// ── Budget lifecycle ───────────────────────────────────────────────────────

export const compileBudget = createValidatedOrgAction(
  compileBudgetSchema,
  async (supabase, _actor, _groupId, input) => {
    const detail = await getBudgetDetailDal(supabase, input.id)
    if (!detail) throw new UserFacingError('Budget not found')
    if (detail.status !== 'drafting') throw new UserFacingError('Budget must be in drafting status')
    if (!canCompile(detail.proposals))
      throw new UserFacingError('All proposals must be submitted before compiling')
    const result = await compileBudgetDal(supabase, input.id)
    if (!result.success) throw new UserFacingError(result.error ?? 'Operation failed')
  },
  { revalidatePaths: ['/budget'] }
)

export const approveBudget = createValidatedOrgAction(
  approveBudgetSchema,
  async (supabase, actor, _groupId, input) => {
    const detail = await getBudgetDetailDal(supabase, input.id)
    if (!detail) throw new UserFacingError('Budget not found')
    if ((detail.approval_mode as ApprovalMode) === 'vote')
      throw new UserFacingError('A vote-mode budget is ratified by its poll, not approved')
    await assertApproverTreasurer(supabase, detail)
    const result = await approveBudgetDal(supabase, input.id, actor.personId)
    if (!result.success) throw new UserFacingError(result.error ?? 'Operation failed')
  },
  { revalidatePaths: ['/budget'] }
)

export const returnBudgetToDraft = createValidatedOrgAction(
  returnBudgetToDraftSchema,
  async (supabase, _actor, _groupId, input) => {
    const result = await returnBudgetToDraftDal(supabase, input.id)
    if (!result.success) throw new UserFacingError(result.error ?? 'Operation failed')
  },
  { revalidatePaths: ['/budget'] }
)

export const archiveBudget = createValidatedOrgAction(
  archiveBudgetSchema,
  async (supabase, _actor, _groupId, input) => {
    const result = await archiveBudgetDal(supabase, input.id)
    if (!result.success) throw new UserFacingError(result.error ?? 'Operation failed')
  },
  { revalidatePaths: ['/budget'] }
)

export const createBudgetRatificationPoll = createValidatedOrgAction(
  createRatificationPollSchema,
  async (supabase, actor, _groupId, input) => {
    const detail = await getBudgetDetailDal(supabase, input.id)
    if (!detail) throw new UserFacingError('Budget not found')
    if (detail.poll_id) throw new UserFacingError('Ratification poll already exists')
    if (
      !canCreateRatificationPoll(
        detail.status as BudgetStatus,
        detail.approval_mode as ApprovalMode
      )
    ) {
      throw new UserFacingError(
        detail.approval_mode === 'approver'
          ? 'This budget is approved directly — it has no ratification vote'
          : 'The budget is not ready for its ratification vote yet'
      )
    }
    await assertApproverTreasurer(supabase, detail)

    const approverGroupId = detail.approver_group_id ?? detail.group_id
    const admin = serviceRoleClient()

    const pollId = await createPollDal(admin, approverGroupId, actor.personId, {
      title: `Budget Ratification: ${detail.title}`,
      description: `Vote to ratify the ${detail.title}`,
      voting_method: 'supermajority',
      method_settings: { threshold: 2 / 3 },
      vote_privacy: 'private',
      allow_abstain: true,
      term_id: detail.term_id,
      options: [
        { label: 'Approve', description: 'Ratify this budget' },
        { label: 'Reject', description: 'Do not ratify' },
      ],
    })

    const memberIds = await getActiveMemberPersonIdsDal(admin, approverGroupId)
    await addParticipantsDal(admin, pollId, memberIds)
    await publishPollDal(admin, pollId)

    const linked = await linkPollToBudgetDal(supabase, input.id, pollId)
    if (!linked.success) throw new UserFacingError(linked.error ?? 'Failed to link poll')

    return pollId
  },
  { revalidatePaths: ['/budget'] }
)

/**
 * Manual ratification exists only in 'approver' mode. Poll-driven modes are
 * ratified by the poll close running the supermajority result — see
 * applyBudgetRatificationOutcome in polls.action.ts.
 */
export const ratifyBudget = createValidatedOrgAction(
  ratifyBudgetSchema,
  async (supabase, _actor, _groupId, input) => {
    const detail = await getBudgetDetailDal(supabase, input.id)
    if (!detail) throw new UserFacingError('Budget not found')
    if (!canManuallyRatify(detail.status as BudgetStatus, detail.approval_mode as ApprovalMode))
      throw new UserFacingError('This budget is ratified by its ratification vote, not manually')
    await assertApproverTreasurer(supabase, detail)

    const result = await ratifyBudgetDal(supabase, input.id, 'approved')
    if (!result.success) throw new UserFacingError(result.error ?? 'Operation failed')

    try {
      // The audience is the budget's OWNING group — the chapter whose budget
      // was just ratified — not whichever group's context the click came from
      const memberIds = await getActiveMemberPersonIdsDal(supabase, detail.group_id)
      await notifyBudgetRatified(supabase, detail.group_id, detail.title, '/budget', memberIds)
    } catch {
      // Notifications are best-effort
    }
  },
  { revalidatePaths: ['/budget'] }
)

// ── Proposal mutations ─────────────────────────────────────────────────────

export const createProposal = createValidatedOrgAction(
  createProposalSchema,
  async (supabase, actor, _groupId, input) => {
    return createProposalDal(supabase, {
      ...input,
      submitted_by: actor.personId,
    })
  },
  { revalidatePaths: ['/budget'] }
)

export const updateProposal = createValidatedOrgAction(
  updateProposalSchema,
  async (supabase, _actor, _groupId, input) => {
    const { id, ...updates } = input
    const result = await updateProposalDal(supabase, id, updates)
    if (!result.success) throw new UserFacingError(result.error ?? 'Operation failed')
  },
  { revalidatePaths: ['/budget'] }
)

export const submitProposal = createValidatedOrgAction(
  submitProposalSchema,
  async (supabase, _actor, _groupId, input) => {
    const owner = await getProposalOwnerDal(supabase, input.id)
    if (!owner) throw new UserFacingError('Proposal not found')

    const result = await submitProposalDal(supabase, input.id)
    if (!result.success) throw new UserFacingError(result.error ?? 'Submit failed')

    try {
      const detail = await getBudgetDetailDal(supabase, owner.budget_id)
      if (detail) {
        const proposal = detail.proposals.find((p) => p.id === input.id)
        const label = proposal?.position_name ?? proposal?.subgroup_name ?? 'General'
        const treasurerIds = await getTreasurerPersonIdsDal(supabase, detail.group_id)
        if (treasurerIds.length > 0) {
          await notifyBudgetProposalSubmitted(
            supabase,
            detail.group_id,
            label,
            '/budget',
            treasurerIds
          )
        }
      }
    } catch {
      // Notifications are best-effort — don't fail the submit
    }
  },
  { revalidatePaths: ['/budget'] }
)

export const returnProposal = createValidatedOrgAction(
  returnProposalSchema,
  async (supabase, _actor, _groupId, input) => {
    const owner = await getProposalOwnerDal(supabase, input.id)
    if (!owner) throw new UserFacingError('Proposal not found')

    const detail = await getBudgetDetailDal(supabase, owner.budget_id)
    if (!detail) throw new UserFacingError('Budget not found')
    if (!['drafting', 'in_review'].includes(detail.status))
      throw new UserFacingError('Proposals can only be returned before the budget is approved')

    const result = await returnProposalDal(supabase, input.id, input.notes)
    if (!result.success) throw new UserFacingError(result.error ?? 'Operation failed')

    // A compiled budget no longer has all proposals submitted — reopen it so
    // the holder can revise and the treasurer can recompile
    if (detail.status === 'in_review') {
      const reopened = await returnBudgetToDraftDal(supabase, owner.budget_id)
      if (!reopened.success) throw new UserFacingError(reopened.error ?? 'Operation failed')
    }

    try {
      await notifyBudgetReturned(
        supabase,
        detail.group_id,
        detail.title,
        '/budget',
        owner.submitted_by
      )
    } catch {
      // Notifications are best-effort
    }
  },
  { revalidatePaths: ['/budget'] }
)

export const deleteProposal = createValidatedOrgAction(
  deleteProposalSchema,
  async (supabase, _actor, _groupId, input) => {
    const result = await deleteProposalDal(supabase, input.id)
    if (!result.success) throw new UserFacingError(result.error ?? 'Operation failed')
  },
  { revalidatePaths: ['/budget'] }
)

// ── Line item mutations ────────────────────────────────────────────────────

export const createLineItem = createValidatedOrgAction(
  createLineItemSchema,
  async (supabase, _actor, _groupId, input) => {
    return createLineItemDal(supabase, input)
  },
  { revalidatePaths: ['/budget'] }
)

export const updateLineItem = createValidatedOrgAction(
  updateLineItemSchema,
  async (supabase, _actor, _groupId, input) => {
    const { id, ...updates } = input
    const result = await updateLineItemDal(supabase, id, updates)
    if (!result.success) throw new UserFacingError(result.error ?? 'Update failed')
  },
  { revalidatePaths: ['/budget'] }
)

export const deleteLineItem = createValidatedOrgAction(
  deleteLineItemSchema,
  async (supabase, _actor, _groupId, input) => {
    const result = await deleteLineItemDal(supabase, input.id)
    if (!result.success) throw new UserFacingError(result.error ?? 'Operation failed')
  },
  { revalidatePaths: ['/budget'] }
)
