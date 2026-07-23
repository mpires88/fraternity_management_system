import type { DbClient, MutationResult } from '@/dal/types'
import type { BudgetStatus, ProposalStatus } from '@/lib/utils/budgets'

// ── Types ──────────────────────────────────────────────────────────────────

export type BudgetRow = {
  id: string
  group_id: string
  term_id: string
  title: string
  status: BudgetStatus
  approval_mode: string
  approver_group_id: string | null
  approver_position_id: string | null
  poll_id: string | null
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  ratified_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type BudgetWithProposals = BudgetRow & {
  proposals: ProposalWithItems[]
}

export type ProposalRow = {
  id: string
  budget_id: string
  position_id: string | null
  subgroup_id: string | null
  submitted_by: string
  status: ProposalStatus
  submitted_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ProposalWithItems = ProposalRow & {
  position_name: string | null
  subgroup_name: string | null
  submitted_by_name: string
  line_items: LineItemRow[]
}

export type LineItemRow = {
  id: string
  proposal_id: string
  description: string
  amount: number
  category: string | null
  notes: string | null
  display_order: number | null
}

// ── Budget queries ─────────────────────────────────────────────────────────

export async function getBudgetsForGroupDal(
  supabase: DbClient,
  groupId: string,
  termId?: string
): Promise<BudgetRow[]> {
  let query = supabase
    .from('budgets')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (termId) query = query.eq('term_id', termId)

  const { data } = await query
  return (data ?? []) as BudgetRow[]
}

export async function getBudgetDetailDal(
  supabase: DbClient,
  budgetId: string
): Promise<BudgetWithProposals | null> {
  const { data } = await supabase
    .from('budgets')
    .select(
      `*,
       budget_proposals(
         *,
         position:positions(title),
         subgroup:subgroups(name),
         submitter:persons!budget_proposals_submitted_by_fkey(full_name),
         budget_line_items(*)
       )`
    )
    .eq('id', budgetId)
    .maybeSingle()

  if (!data) return null

  const row = data as Record<string, unknown>
  const base = data as unknown as BudgetRow
  const rawProposals = (row.budget_proposals ?? []) as Array<{
    id: string
    budget_id: string
    position_id: string | null
    subgroup_id: string | null
    submitted_by: string
    status: string
    submitted_at: string | null
    notes: string | null
    created_at: string
    updated_at: string
    position: { title: string } | null
    subgroup: { name: string } | null
    submitter: { full_name: string } | null
    budget_line_items: LineItemRow[]
  }>

  return {
    ...base,
    proposals: rawProposals.map((p) => ({
      id: p.id,
      budget_id: p.budget_id,
      position_id: p.position_id,
      subgroup_id: p.subgroup_id,
      submitted_by: p.submitted_by,
      status: p.status as ProposalStatus,
      submitted_at: p.submitted_at,
      notes: p.notes,
      created_at: p.created_at,
      updated_at: p.updated_at,
      position_name: p.position?.title ?? null,
      subgroup_name: p.subgroup?.name ?? null,
      submitted_by_name: p.submitter?.full_name ?? 'Unknown',
      line_items: p.budget_line_items ?? [],
    })),
  }
}

/** The budget a poll ratifies, if any (budgets.poll_id points AT polls). */
export async function getBudgetByPollIdDal(
  supabase: DbClient,
  pollId: string
): Promise<BudgetRow | null> {
  const { data } = await supabase.from('budgets').select('*').eq('poll_id', pollId).maybeSingle()
  return data as BudgetRow | null
}

// ── Budget mutations ───────────────────────────────────────────────────────

export async function createBudgetDal(
  supabase: DbClient,
  groupId: string,
  createdBy: string,
  input: {
    title: string
    term_id: string
    approval_mode?: string
    approver_group_id?: string | null
    approver_position_id?: string | null
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('budgets')
    .insert({
      group_id: groupId,
      created_by: createdBy,
      title: input.title,
      term_id: input.term_id,
      approval_mode: input.approval_mode ?? 'approver',
      approver_group_id: input.approver_group_id ?? null,
      approver_position_id: input.approver_position_id ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create budget: ${error.message}`)
  return data.id
}

export async function updateBudgetDal(
  supabase: DbClient,
  budgetId: string,
  updates: {
    title?: string
    approval_mode?: string
    approver_group_id?: string | null
    approver_position_id?: string | null
  }
): Promise<MutationResult<void>> {
  // Title/mode/approver settings are load-bearing for who may approve —
  // only editable while drafting (the DB trigger enforces the same rule)
  const { data, error } = await supabase
    .from('budgets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', budgetId)
    .eq('status', 'drafting')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length)
    return { success: false, error: 'Budget settings can only be changed while drafting' }
  return { success: true }
}

export async function deleteBudgetDal(
  supabase: DbClient,
  budgetId: string
): Promise<MutationResult<void>> {
  const { data, error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', budgetId)
    .eq('status', 'drafting')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Only drafting budgets can be deleted' }
  return { success: true }
}

// ── Budget lifecycle ───────────────────────────────────────────────────────

export async function compileBudgetDal(
  supabase: DbClient,
  budgetId: string
): Promise<MutationResult<void>> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('budgets')
    .update({ status: 'in_review', submitted_at: now, updated_at: now })
    .eq('id', budgetId)
    .eq('status', 'drafting')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Budget is no longer in drafting' }
  return { success: true }
}

export async function returnBudgetToDraftDal(
  supabase: DbClient,
  budgetId: string
): Promise<MutationResult<void>> {
  const { data, error } = await supabase
    .from('budgets')
    .update({ status: 'drafting', submitted_at: null, updated_at: new Date().toISOString() })
    .eq('id', budgetId)
    .eq('status', 'in_review')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Budget is not in review' }
  return { success: true }
}

export async function approveBudgetDal(
  supabase: DbClient,
  budgetId: string,
  approvedBy: string
): Promise<MutationResult<void>> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('budgets')
    .update({ status: 'approved', approved_at: now, approved_by: approvedBy, updated_at: now })
    .eq('id', budgetId)
    .eq('status', 'in_review')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Budget is not in review' }
  return { success: true }
}

/**
 * fromStatus: 'approved' for approver / approver_then_vote flows,
 * 'in_review' for vote mode (the passing poll IS the approval) — see
 * pollRatifiesFrom in lib/utils/budgets.
 */
export async function ratifyBudgetDal(
  supabase: DbClient,
  budgetId: string,
  fromStatus: 'approved' | 'in_review' = 'approved'
): Promise<MutationResult<void>> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('budgets')
    .update({ status: 'ratified', ratified_at: now, updated_at: now })
    .eq('id', budgetId)
    .eq('status', fromStatus)
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Budget is not ready to be ratified' }
  return { success: true }
}

export async function archiveBudgetDal(
  supabase: DbClient,
  budgetId: string
): Promise<MutationResult<void>> {
  const { data, error } = await supabase
    .from('budgets')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', budgetId)
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Budget not found or not yours to archive' }
  return { success: true }
}

export async function linkPollToBudgetDal(
  supabase: DbClient,
  budgetId: string,
  pollId: string
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from('budgets')
    .update({ poll_id: pollId, updated_at: new Date().toISOString() })
    .eq('id', budgetId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Proposal mutations ─────────────────────────────────────────────────────

export async function createProposalDal(
  supabase: DbClient,
  input: {
    budget_id: string
    submitted_by: string
    position_id?: string | null
    subgroup_id?: string | null
    notes?: string | null
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('budget_proposals')
    .insert({
      budget_id: input.budget_id,
      submitted_by: input.submitted_by,
      position_id: input.position_id ?? null,
      subgroup_id: input.subgroup_id ?? null,
      notes: input.notes ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create proposal: ${error.message}`)
  return data.id
}

export async function updateProposalDal(
  supabase: DbClient,
  proposalId: string,
  updates: { notes?: string | null }
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from('budget_proposals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', proposalId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function submitProposalDal(
  supabase: DbClient,
  proposalId: string
): Promise<MutationResult<void>> {
  const now = new Date().toISOString()
  // A returned proposal is resubmittable — that's the revise loop
  const { data, error } = await supabase
    .from('budget_proposals')
    .update({ status: 'submitted', submitted_at: now, updated_at: now })
    .eq('id', proposalId)
    .in('status', ['draft', 'returned'])
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length)
    return { success: false, error: 'Proposal is already submitted or not editable by you' }
  return { success: true }
}

export async function returnProposalDal(
  supabase: DbClient,
  proposalId: string,
  notes?: string | null
): Promise<MutationResult<void>> {
  const updates: Record<string, unknown> = {
    status: 'returned',
    updated_at: new Date().toISOString(),
  }
  if (notes !== undefined) updates.notes = notes
  const { data, error } = await supabase
    .from('budget_proposals')
    .update(updates)
    .eq('id', proposalId)
    .eq('status', 'submitted')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Only a submitted proposal can be returned' }
  return { success: true }
}

export async function deleteProposalDal(
  supabase: DbClient,
  proposalId: string
): Promise<MutationResult<void>> {
  const { error } = await supabase.from('budget_proposals').delete().eq('id', proposalId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Line item mutations ────────────────────────────────────────────────────

export async function createLineItemDal(
  supabase: DbClient,
  input: {
    proposal_id: string
    description: string
    amount: number
    category?: string | null
    notes?: string | null
    display_order?: number
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('budget_line_items')
    .insert({
      proposal_id: input.proposal_id,
      description: input.description,
      amount: input.amount,
      category: input.category ?? null,
      notes: input.notes ?? null,
      display_order: input.display_order ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create line item: ${error.message}`)
  return data.id
}

export async function updateLineItemDal(
  supabase: DbClient,
  lineItemId: string,
  updates: {
    description?: string
    amount?: number
    category?: string | null
    notes?: string | null
    display_order?: number
  }
): Promise<MutationResult<void>> {
  const { error } = await supabase.from('budget_line_items').update(updates).eq('id', lineItemId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteLineItemDal(
  supabase: DbClient,
  lineItemId: string
): Promise<MutationResult<void>> {
  const { error } = await supabase.from('budget_line_items').delete().eq('id', lineItemId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Helpers ────────────────────────────────────────────────────────────────

export async function getProposalOwnerDal(
  supabase: DbClient,
  proposalId: string
): Promise<{ budget_id: string; submitted_by: string; status: string } | null> {
  const { data } = await supabase
    .from('budget_proposals')
    .select('budget_id, submitted_by, status')
    .eq('id', proposalId)
    .maybeSingle()
  return data
}

export async function getLineItemOwnerDal(
  supabase: DbClient,
  lineItemId: string
): Promise<{ proposal_id: string; submitted_by: string; proposal_status: string } | null> {
  const { data } = await supabase
    .from('budget_line_items')
    .select('proposal_id, budget_proposals(submitted_by, status)')
    .eq('id', lineItemId)
    .maybeSingle()
  if (!data) return null
  const proposal = (data as Record<string, unknown>).budget_proposals as {
    submitted_by: string
    status: string
  } | null
  return {
    proposal_id: data.proposal_id,
    submitted_by: proposal?.submitted_by ?? '',
    proposal_status: proposal?.status ?? '',
  }
}
