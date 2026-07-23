import type { DbClient, MutationResult } from '@/dal/types'

// ── Types ──────────────────────────────────────────────────────────────────

export type ReimbursementStatus = 'submitted' | 'approved' | 'rejected' | 'reimbursed' | 'credited'

export type ReimbursementRow = {
  id: string
  group_id: string
  term_id: string | null
  submitted_by: string
  amount: number
  description: string
  occurred_on: string
  receipt_paths: string[] | null
  proposal_id: string | null
  line_item_id: string | null
  status: ReimbursementStatus
  approved_by: string | null
  approved_at: string | null
  resolved_by: string | null
  resolved_at: string | null
  resolution_note: string | null
  applied_progress_entry_id: string | null
  external_ref: string | null
  created_at: string
  updated_at: string
}

export type ReimbursementWithDetails = ReimbursementRow & {
  submitter_name: string
  approver_name: string | null
  resolver_name: string | null
  proposal_label: string | null
  proposal_position_id: string | null
  line_item_description: string | null
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getReimbursementsForGroupDal(
  supabase: DbClient,
  groupId: string,
  termId?: string
): Promise<ReimbursementWithDetails[]> {
  let query = supabase
    .from('reimbursements')
    .select(
      `*,
       submitter:persons!reimbursements_submitted_by_fkey(full_name),
       approver:persons!reimbursements_approved_by_fkey(full_name),
       resolver:persons!reimbursements_resolved_by_fkey(full_name),
       proposal:budget_proposals(
         position_id,
         position:positions(title),
         subgroup:subgroups(name)
       ),
       line_item:budget_line_items(description)`
    )
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  // Include rows submitted while no term was active — they must not vanish
  // from the queues once a term starts
  if (termId) query = query.or(`term_id.eq.${termId},term_id.is.null`)

  const { data } = await query
  if (!data) return []

  return data.map((row) => {
    const r = row as Record<string, unknown>
    const submitter = r.submitter as { full_name: string } | null
    const approver = r.approver as { full_name: string } | null
    const resolver = r.resolver as { full_name: string } | null
    const proposal = r.proposal as {
      position_id: string | null
      position: { title: string } | null
      subgroup: { name: string } | null
    } | null
    const lineItem = r.line_item as { description: string } | null

    const proposalLabel = proposal?.position?.title ?? proposal?.subgroup?.name ?? null

    return {
      ...(row as unknown as ReimbursementRow),
      submitter_name: submitter?.full_name ?? 'Unknown',
      approver_name: approver?.full_name ?? null,
      resolver_name: resolver?.full_name ?? null,
      proposal_label: proposalLabel,
      proposal_position_id: proposal?.position_id ?? null,
      line_item_description: lineItem?.description ?? null,
    }
  })
}

export async function getReimbursementByIdDal(
  supabase: DbClient,
  reimbursementId: string
): Promise<ReimbursementWithDetails | null> {
  const { data } = await supabase
    .from('reimbursements')
    .select(
      `*,
       submitter:persons!reimbursements_submitted_by_fkey(full_name),
       approver:persons!reimbursements_approved_by_fkey(full_name),
       resolver:persons!reimbursements_resolved_by_fkey(full_name),
       proposal:budget_proposals(
         position_id,
         position:positions(title),
         subgroup:subgroups(name)
       ),
       line_item:budget_line_items(description)`
    )
    .eq('id', reimbursementId)
    .maybeSingle()

  if (!data) return null

  const r = data as Record<string, unknown>
  const submitter = r.submitter as { full_name: string } | null
  const approver = r.approver as { full_name: string } | null
  const resolver = r.resolver as { full_name: string } | null
  const proposal = r.proposal as {
    position_id: string | null
    position: { title: string } | null
    subgroup: { name: string } | null
  } | null
  const lineItem = r.line_item as { description: string } | null

  return {
    ...(data as unknown as ReimbursementRow),
    submitter_name: submitter?.full_name ?? 'Unknown',
    approver_name: approver?.full_name ?? null,
    resolver_name: resolver?.full_name ?? null,
    proposal_label: proposal?.position?.title ?? proposal?.subgroup?.name ?? null,
    proposal_position_id: proposal?.position_id ?? null,
    line_item_description: lineItem?.description ?? null,
  }
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function createReimbursementDal(
  supabase: DbClient,
  groupId: string,
  submittedBy: string,
  input: {
    amount: number
    description: string
    occurred_on: string
    receipt_paths?: string[] | null
    proposal_id?: string | null
    term_id?: string | null
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('reimbursements')
    .insert({
      group_id: groupId,
      submitted_by: submittedBy,
      amount: input.amount,
      description: input.description,
      occurred_on: input.occurred_on,
      receipt_paths: input.receipt_paths ?? null,
      proposal_id: input.proposal_id ?? null,
      term_id: input.term_id ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create reimbursement: ${error.message}`)
  return data.id
}

export async function approveReimbursementDal(
  supabase: DbClient,
  reimbursementId: string,
  approvedBy: string,
  lineItemId?: string | null
): Promise<MutationResult<void>> {
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    status: 'approved',
    approved_by: approvedBy,
    approved_at: now,
    updated_at: now,
  }
  if (lineItemId !== undefined) updates.line_item_id = lineItemId
  const { data, error } = await supabase
    .from('reimbursements')
    .update(updates)
    .eq('id', reimbursementId)
    .eq('status', 'submitted')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length)
    return { success: false, error: 'Request is no longer pending, or not yours to approve' }
  return { success: true }
}

export async function rejectReimbursementDal(
  supabase: DbClient,
  reimbursementId: string,
  resolvedBy: string,
  note?: string | null
): Promise<MutationResult<void>> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('reimbursements')
    .update({
      status: 'rejected',
      resolved_by: resolvedBy,
      resolved_at: now,
      resolution_note: note ?? null,
      updated_at: now,
    })
    .eq('id', reimbursementId)
    .in('status', ['submitted', 'approved'])
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length)
    return { success: false, error: 'Request is already resolved, or not yours to reject' }
  return { success: true }
}

export async function reimburseReimbursementDal(
  supabase: DbClient,
  reimbursementId: string,
  resolvedBy: string,
  note?: string | null,
  externalRef?: string | null
): Promise<MutationResult<void>> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('reimbursements')
    .update({
      status: 'reimbursed',
      resolved_by: resolvedBy,
      resolved_at: now,
      resolution_note: note ?? null,
      external_ref: externalRef ?? null,
      updated_at: now,
    })
    .eq('id', reimbursementId)
    .eq('status', 'approved')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length)
    return { success: false, error: 'Request is not approved, or was already resolved' }
  return { success: true }
}

/**
 * Compare-and-set the status flip FIRST (before any progress entry exists) so
 * two concurrent credit attempts cannot both proceed — the loser's 0-row
 * update fails here and no duplicate credit entry is ever created. The entry
 * id is attached afterwards via linkCreditEntryDal.
 */
export async function markCreditedReimbursementDal(
  supabase: DbClient,
  reimbursementId: string,
  resolvedBy: string,
  note?: string | null
): Promise<MutationResult<void>> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('reimbursements')
    .update({
      status: 'credited',
      resolved_by: resolvedBy,
      resolved_at: now,
      resolution_note: note ?? null,
      updated_at: now,
    })
    .eq('id', reimbursementId)
    .eq('status', 'approved')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length)
    return { success: false, error: 'Request is not approved, or was already resolved' }
  return { success: true }
}

export async function linkCreditEntryDal(
  supabase: DbClient,
  reimbursementId: string,
  progressEntryId: string
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from('reimbursements')
    .update({ applied_progress_entry_id: progressEntryId, updated_at: new Date().toISOString() })
    .eq('id', reimbursementId)
    .eq('status', 'credited')
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/** Roll a failed credit back to 'approved' so the treasurer can retry. */
export async function revertCreditReimbursementDal(
  supabase: DbClient,
  reimbursementId: string
): Promise<MutationResult<void>> {
  const { error } = await supabase
    .from('reimbursements')
    .update({
      status: 'approved',
      resolved_by: null,
      resolved_at: null,
      resolution_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reimbursementId)
    .eq('status', 'credited')
    .is('applied_progress_entry_id', null)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function withdrawReimbursementDal(
  supabase: DbClient,
  reimbursementId: string
): Promise<MutationResult<void>> {
  const { data, error } = await supabase
    .from('reimbursements')
    .delete()
    .eq('id', reimbursementId)
    .eq('status', 'submitted')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length)
    return { success: false, error: 'Request was already reviewed and can no longer be withdrawn' }
  return { success: true }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const RECEIPTS_BUCKET = 'receipts'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

/**
 * Signed display URLs for receipt paths, keyed by path. The bucket is
 * private; RLS on storage.objects scopes reads to the submitter, the
 * group's treasurer, and the linked proposal's position holder.
 */
export async function resolveReceiptUrlsDal(
  supabase: DbClient,
  paths: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))]
  if (unique.length === 0) return {}
  const { data } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS)
  const out: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl
  }
  return out
}

export async function getPersonNameDal(supabase: DbClient, personId: string): Promise<string> {
  const { data } = await supabase
    .from('persons')
    .select('full_name')
    .eq('id', personId)
    .maybeSingle()
  return data?.full_name ?? 'A member'
}

/**
 * The credit target must be validated before money is applied: the assignment
 * has to belong to the reimbursement's submitter, be a payment requirement,
 * and live in the same group.
 */
export async function getCreditTargetAssignmentDal(
  supabase: DbClient,
  assignmentId: string
): Promise<{ person_id: string; kind: string; group_id: string } | null> {
  const { data } = await supabase
    .from('requirement_assignments')
    .select('person_id, requirements!inner(kind, group_id)')
    .eq('id', assignmentId)
    .maybeSingle()
  if (!data) return null
  const req = data.requirements as unknown as { kind: string; group_id: string }
  return { person_id: data.person_id, kind: req.kind, group_id: req.group_id }
}

/**
 * Incomplete payment assignments for one person in one group — the only
 * valid targets when the treasurer applies a reimbursement as a credit.
 */
export async function getPaymentAssignmentsForPersonDal(
  supabase: DbClient,
  groupId: string,
  personId: string
): Promise<Array<{ id: string; title: string }>> {
  const { data } = await supabase
    .from('requirement_assignments')
    .select('id, status, requirements!inner(title, kind, group_id)')
    .eq('person_id', personId)
    .eq('requirements.kind', 'payment')
    .eq('requirements.group_id', groupId)
    .neq('status', 'complete')

  return (data ?? []).map((row) => {
    const req = row.requirements as unknown as { title: string }
    return { id: row.id, title: req.title }
  })
}

/** Line items of a proposal — the options when the area officer pins a
 * reimbursement to a budget line at approval. */
export async function getLineItemsForProposalDal(
  supabase: DbClient,
  proposalId: string
): Promise<Array<{ id: string; description: string; amount: number }>> {
  const { data } = await supabase
    .from('budget_line_items')
    .select('id, description, amount')
    .eq('proposal_id', proposalId)
    .order('display_order', { ascending: true })
  return (data ?? []) as Array<{ id: string; description: string; amount: number }>
}

/** The line item must belong to the reimbursement's own linked proposal for
 * spent-vs-budgeted attribution to mean anything. */
export async function lineItemBelongsToProposalDal(
  supabase: DbClient,
  lineItemId: string,
  proposalId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('budget_line_items')
    .select('id')
    .eq('id', lineItemId)
    .eq('proposal_id', proposalId)
    .maybeSingle()
  return !!data
}

export async function getReimbursementOwnerDal(
  supabase: DbClient,
  reimbursementId: string
): Promise<{
  submitted_by: string
  group_id: string
  status: string
  proposal_id: string | null
} | null> {
  const { data } = await supabase
    .from('reimbursements')
    .select('submitted_by, group_id, status, proposal_id')
    .eq('id', reimbursementId)
    .maybeSingle()
  return data
}

/**
 * Find the current holder(s) of the position linked to a budget proposal.
 * Used for routing reimbursement notifications to the area officer.
 */
export async function getProposalPositionHoldersDal(
  supabase: DbClient,
  proposalId: string,
  groupId: string
): Promise<string[]> {
  const { data: proposal } = await supabase
    .from('budget_proposals')
    .select('position_id')
    .eq('id', proposalId)
    .maybeSingle()

  if (!proposal?.position_id) return []

  const { data: holders } = await supabase
    .from('position_assignments')
    .select('person_id')
    .eq('position_id', proposal.position_id)
    .eq('group_id', groupId)
    .is('term_end', null)

  return (holders ?? []).map((h) => h.person_id)
}

/**
 * Proposals available for the reimbursement area picker —
 * all non-draft proposals in the group's active-term budgets.
 */
export async function getProposalsForPickerDal(
  supabase: DbClient,
  groupId: string
): Promise<
  Array<{
    id: string
    budget_title: string
    label: string
  }>
> {
  const { data } = await supabase
    .from('budget_proposals')
    .select(
      `id,
       budget:budgets!inner(title, group_id, status),
       position:positions(title),
       subgroup:subgroups(name)`
    )
    .neq('status', 'draft')

  if (!data) return []

  return data
    .filter((row) => {
      const budget = row.budget as unknown as {
        group_id: string
        status: string
      }
      return budget.group_id === groupId && !['archived'].includes(budget.status)
    })
    .map((row) => {
      const budget = row.budget as unknown as { title: string }
      const position = row.position as { title: string } | null
      const subgroup = row.subgroup as { name: string } | null
      return {
        id: row.id,
        budget_title: budget.title,
        label: position?.title ?? subgroup?.name ?? 'General',
      }
    })
}
