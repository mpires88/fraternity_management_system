export type BudgetStatus = 'drafting' | 'in_review' | 'approved' | 'ratified' | 'archived'
export type ProposalStatus = 'draft' | 'submitted' | 'returned'
export type ApprovalMode = 'approver' | 'vote' | 'approver_then_vote'

export type LineItemInput = {
  amount: number
  category: string | null
  description: string
}

export type ProposalInput = {
  id: string
  position_name: string | null
  subgroup_name: string | null
  status: ProposalStatus
  line_items: LineItemInput[]
}

export type ProposalRollup = {
  proposalId: string
  positionName: string | null
  subgroupName: string | null
  status: ProposalStatus
  total: number
  byCategory: Record<string, number>
}

export type BudgetRollup = {
  grandTotal: number
  byCategory: Record<string, number>
  proposals: ProposalRollup[]
}

/** Currency must be summed in integer cents — naive float addition drifts
 * (0.1 + 0.2), and spent-vs-budgeted comparisons break at cent boundaries. */
const toCents = (amount: number) => Math.round(amount * 100)
const fromCents = (cents: number) => cents / 100

export function rollupBudget(proposals: ProposalInput[]): BudgetRollup {
  const grandByCategory: Record<string, number> = {}
  let grandTotalCents = 0

  const proposalRollups: ProposalRollup[] = proposals.map((p) => {
    const byCategory: Record<string, number> = {}
    let totalCents = 0

    for (const item of p.line_items) {
      const cents = toCents(item.amount)
      totalCents += cents
      const cat = item.category?.trim() ? item.category : 'Uncategorized'
      byCategory[cat] = (byCategory[cat] ?? 0) + cents
      grandByCategory[cat] = (grandByCategory[cat] ?? 0) + cents
    }

    grandTotalCents += totalCents

    return {
      proposalId: p.id,
      positionName: p.position_name,
      subgroupName: p.subgroup_name,
      status: p.status,
      total: fromCents(totalCents),
      byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, fromCents(v)])),
    }
  })

  for (const cat of Object.keys(grandByCategory)) {
    grandByCategory[cat] = fromCents(grandByCategory[cat])
  }

  return {
    grandTotal: fromCents(grandTotalCents),
    byCategory: grandByCategory,
    proposals: proposalRollups,
  }
}

/**
 * Lifecycle per approval mode:
 * - 'approver':            drafting → in_review → approved → ratified
 *                          (approver-group treasurer approves, then ratifies)
 * - 'vote':                drafting → in_review → ratified
 *                          (no approver step; the ratification poll passing
 *                          IS the approval)
 * - 'approver_then_vote':  drafting → in_review → approved → ratified
 *                          (approver signs off, then the poll passing
 *                          ratifies)
 * Any status can be archived. Poll-driven ratification is applied by the
 * poll-close action; the manual ratify control exists only in 'approver'
 * mode. The DB enforces the same matrix in enforce_budget_transition().
 */
export type TransitionContext = {
  allProposalsSubmitted: boolean
  pollPassed: boolean
  approvalMode: ApprovalMode
}

export function nextBudgetStatuses(current: BudgetStatus, ctx: TransitionContext): BudgetStatus[] {
  const statuses: BudgetStatus[] = []
  const { approvalMode } = ctx

  switch (current) {
    case 'drafting':
      if (ctx.allProposalsSubmitted) statuses.push('in_review')
      break
    case 'in_review':
      statuses.push('drafting')
      if (approvalMode !== 'vote') statuses.push('approved')
      if (approvalMode === 'vote' && ctx.pollPassed) statuses.push('ratified')
      break
    case 'approved':
      if (approvalMode === 'approver') statuses.push('ratified')
      if (approvalMode === 'approver_then_vote' && ctx.pollPassed) statuses.push('ratified')
      break
    case 'ratified':
    case 'archived':
      break
  }

  if (current !== 'archived') statuses.push('archived')
  return statuses
}

/** A ratification poll exists only in the poll-driven modes, and only once
 * the budget has cleared every earlier gate. */
export function canCreateRatificationPoll(status: BudgetStatus, mode: ApprovalMode): boolean {
  return (
    (mode === 'vote' && status === 'in_review') ||
    (mode === 'approver_then_vote' && status === 'approved')
  )
}

/** The manual ratify control is only for 'approver' mode — poll-driven
 * budgets are ratified by their poll closing with a passing result. */
export function canManuallyRatify(status: BudgetStatus, mode: ApprovalMode): boolean {
  return mode === 'approver' && status === 'approved'
}

/** The status a passing, budget-linked poll ratifies from, per mode.
 * Returns null when a poll should not exist for the mode at all. */
export function pollRatifiesFrom(mode: ApprovalMode): 'in_review' | 'approved' | null {
  if (mode === 'vote') return 'in_review'
  if (mode === 'approver_then_vote') return 'approved'
  return null
}

export function canCompile(proposals: ProposalInput[]): boolean {
  if (proposals.length === 0) return false
  return proposals.every((p) => p.status === 'submitted')
}
