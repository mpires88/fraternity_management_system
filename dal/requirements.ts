import type { DbClient } from '@/dal/types'
import { UserFacingError } from '@/lib/errors'

export type RequirementRow = {
  id: string
  title: string
  description: string | null
  kind: string
  due_at: string | null
  occurs_at: string | null
  amount_cents: number | null
  quota_target: number | null
  quota_unit: string | null
  requires_verification: boolean
  assign_to: string
  audience_role_type_ids: string[] | null
  audience_position_ids: string[] | null
  audience_subgroup_ids: string[] | null
  is_active: boolean
  term_id: string
  created_by: string
  created_at: string
  total_assignments: number
  completed_assignments: number
}

export type AssignmentRow = {
  id: string
  requirement_id: string
  person_id: string
  status: string
  progress: number
  completed_at: string | null
  note: string | null
  requirement: {
    id: string
    title: string
    kind: string
    due_at: string | null
    occurs_at: string | null
    amount_cents: number | null
    quota_target: number | null
    quota_unit: string | null
    requires_verification: boolean
  }
}

export type RequirementDetailRow = {
  id: string
  person_id: string
  person_name: string
  status: string
  progress: number
  completed_at: string | null
  verified_by: string | null
  note: string | null
}

export async function getRequirementsForGroup(
  supabase: DbClient,
  groupId: string,
  termId: string
): Promise<RequirementRow[]> {
  const { data: requirements } = await supabase
    .from('requirements')
    .select('*')
    .eq('group_id', groupId)
    .eq('term_id', termId)
    .order('created_at', { ascending: false })

  if (!requirements || requirements.length === 0) return []

  const reqIds = requirements.map((r) => r.id)

  const { data: assignments } = await supabase
    .from('requirement_assignments')
    .select('requirement_id, status')
    .in('requirement_id', reqIds)

  const counts: Record<string, { total: number; completed: number }> = {}
  for (const a of assignments ?? []) {
    if (!counts[a.requirement_id]) counts[a.requirement_id] = { total: 0, completed: 0 }
    counts[a.requirement_id].total++
    if (a.status === 'complete' || a.status === 'waived') counts[a.requirement_id].completed++
  }

  return requirements.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    kind: r.kind,
    due_at: r.due_at,
    occurs_at: r.occurs_at,
    amount_cents: r.amount_cents,
    quota_target: r.quota_target,
    quota_unit: r.quota_unit,
    requires_verification: r.requires_verification,
    assign_to: r.assign_to,
    audience_role_type_ids: r.audience_role_type_ids,
    audience_position_ids: r.audience_position_ids,
    audience_subgroup_ids: r.audience_subgroup_ids,
    is_active: r.is_active,
    term_id: r.term_id,
    created_by: r.created_by,
    created_at: r.created_at,
    total_assignments: counts[r.id]?.total ?? 0,
    completed_assignments: counts[r.id]?.completed ?? 0,
  }))
}

export async function getMyAssignments(
  supabase: DbClient,
  personId: string,
  termId: string
): Promise<AssignmentRow[]> {
  const { data } = await supabase
    .from('requirement_assignments')
    .select(
      'id, requirement_id, person_id, status, progress, completed_at, note, requirements!inner(id, title, kind, due_at, occurs_at, amount_cents, quota_target, quota_unit, requires_verification)'
    )
    .eq('person_id', personId)
    .eq('requirements.term_id', termId)
    .order('created_at', { ascending: true })

  if (!data) return []

  return data.map((row) => ({
    id: row.id,
    requirement_id: row.requirement_id,
    person_id: row.person_id,
    status: row.status ?? 'pending',
    progress: row.progress ?? 0,
    completed_at: row.completed_at,
    note: row.note,
    requirement: row.requirements as AssignmentRow['requirement'],
  }))
}

export async function getRequirementById(supabase: DbClient, requirementId: string) {
  const { data } = await supabase.from('requirements').select('*').eq('id', requirementId).single()
  return data
}

export async function getRequirementDetail(
  supabase: DbClient,
  requirementId: string
): Promise<RequirementDetailRow[]> {
  const { data } = await supabase
    .from('requirement_assignments')
    .select(
      'id, person_id, status, progress, completed_at, verified_by, note, persons!requirement_assignments_person_id_fkey(full_name)'
    )
    .eq('requirement_id', requirementId)
    .order('created_at', { ascending: true })

  if (!data) return []

  return data.map((row) => ({
    id: row.id,
    person_id: row.person_id,
    person_name: (row.persons as { full_name: string })?.full_name ?? 'Unknown',
    status: row.status ?? 'pending',
    progress: row.progress ?? 0,
    completed_at: row.completed_at,
    verified_by: row.verified_by,
    note: row.note,
  }))
}

export async function createRequirementDal(
  supabase: DbClient,
  groupId: string,
  createdBy: string,
  input: {
    title: string
    description?: string | null
    kind: string
    due_at?: string | null
    occurs_at?: string | null
    amount_cents?: number | null
    quota_target?: number | null
    quota_unit?: string | null
    requires_verification?: boolean
    assign_to: string
    audience_role_type_ids?: string[] | null
    audience_position_ids?: string[] | null
    audience_subgroup_ids?: string[] | null
    term_id: string
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('requirements')
    .insert({
      group_id: groupId,
      created_by: createdBy,
      title: input.title,
      description: input.description ?? null,
      kind: input.kind,
      due_at: input.due_at ?? null,
      occurs_at: input.occurs_at ?? null,
      amount_cents: input.amount_cents ?? null,
      quota_target: input.quota_target ?? null,
      quota_unit: input.quota_unit ?? null,
      requires_verification: input.requires_verification ?? false,
      assign_to: input.assign_to,
      audience_role_type_ids: input.audience_role_type_ids ?? null,
      audience_position_ids: input.audience_position_ids ?? null,
      audience_subgroup_ids: input.audience_subgroup_ids ?? null,
      term_id: input.term_id,
    })
    .select('id')
    .single()

  if (error || !data) throw new UserFacingError(error?.message ?? 'Failed to create requirement')
  return data.id
}

export async function updateRequirementDal(
  supabase: DbClient,
  id: string,
  input: {
    title?: string
    description?: string | null
    due_at?: string | null
    occurs_at?: string | null
    amount_cents?: number | null
    quota_target?: number | null
    quota_unit?: string | null
    requires_verification?: boolean
  }
): Promise<void> {
  const { error } = await supabase
    .from('requirements')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new UserFacingError(error.message)
}

export async function archiveRequirementDal(supabase: DbClient, id: string): Promise<void> {
  const { error } = await supabase
    .from('requirements')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new UserFacingError(error.message)
}

export async function insertAssignmentsDal(
  supabase: DbClient,
  requirementId: string,
  personIds: string[]
): Promise<void> {
  if (personIds.length === 0) return

  const rows = personIds.map((pid) => ({
    requirement_id: requirementId,
    person_id: pid,
  }))

  const { error } = await supabase.from('requirement_assignments').upsert(rows, {
    onConflict: 'requirement_id,person_id',
    ignoreDuplicates: true,
  })
  if (error) throw new UserFacingError(error.message)
}

export async function updateAssignmentStatusDal(
  supabase: DbClient,
  assignmentId: string,
  status: string,
  progress?: number
): Promise<void> {
  const updates: Record<string, unknown> = { status }
  if (status === 'complete' || status === 'waived') {
    updates.completed_at = new Date().toISOString()
  }
  if (progress !== undefined) {
    updates.progress = progress
  }
  const { error } = await supabase
    .from('requirement_assignments')
    .update(updates)
    .eq('id', assignmentId)
  if (error) throw new UserFacingError(error.message)
}

export async function updateAssignmentOfficerDal(
  supabase: DbClient,
  assignmentId: string,
  updates: { status?: string; note?: string | null; verified_by?: string | null; progress?: number }
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (updates.status) {
    row.status = updates.status
    if (updates.status === 'complete' || updates.status === 'waived') {
      row.completed_at = new Date().toISOString()
    }
  }
  if (updates.note !== undefined) row.note = updates.note
  if (updates.verified_by !== undefined) row.verified_by = updates.verified_by
  if (updates.progress !== undefined) row.progress = updates.progress

  const { error } = await supabase
    .from('requirement_assignments')
    .update(row)
    .eq('id', assignmentId)
  if (error) throw new UserFacingError(error.message)
}

export async function bulkMarkAttendanceDal(
  supabase: DbClient,
  assignmentIds: string[]
): Promise<void> {
  if (assignmentIds.length === 0) return
  const { error } = await supabase
    .from('requirement_assignments')
    .update({ status: 'complete', completed_at: new Date().toISOString() })
    .in('id', assignmentIds)
  if (error) throw new UserFacingError(error.message)
}

/** Context needed to notify officers when an assignment is submitted. */
export async function getAssignmentSubmissionContextDal(
  supabase: DbClient,
  assignmentId: string
): Promise<{ requirementTitle: string; groupId: string; submitterName: string } | null> {
  const { data } = await supabase
    .from('requirement_assignments')
    .select(
      'requirements!inner(title, group_id), persons!requirement_assignments_person_id_fkey(full_name)'
    )
    .eq('id', assignmentId)
    .maybeSingle()

  if (!data) return null
  const req = data.requirements as unknown as { title: string; group_id: string }
  const person = data.persons as unknown as { full_name: string } | null
  return {
    requirementTitle: req.title,
    groupId: req.group_id,
    submitterName: person?.full_name ?? 'A member',
  }
}

/** starts_on per term id — used to shift dates when cloning across terms. */
export async function getTermStartDatesDal(
  supabase: DbClient,
  termIds: string[]
): Promise<Record<string, string | null>> {
  if (termIds.length === 0) return {}
  const { data } = await supabase.from('terms').select('id, starts_on').in('id', termIds)
  return Object.fromEntries((data ?? []).map((t) => [t.id, t.starts_on]))
}

/** Who logged a progress entry + the requirement title, for notifications. */
export async function getProgressEntryMetaDal(
  supabase: DbClient,
  entryId: string
): Promise<{ loggedBy: string; requirementTitle: string } | null> {
  const { data } = await supabase
    .from('requirement_progress_entries')
    .select('logged_by, requirement_assignments!inner(requirements!inner(title))')
    .eq('id', entryId)
    .maybeSingle()

  if (!data) return null
  const ra = data.requirement_assignments as unknown as { requirements: { title: string } }
  return { loggedBy: data.logged_by, requirementTitle: ra.requirements.title }
}

export async function getAudienceContext(supabase: DbClient, groupId: string, termId: string) {
  const [membersRes, holdersRes, subMembersRes] = await Promise.all([
    supabase
      .from('group_memberships')
      .select('person_id, role_type_id, status_definitions!inner(slug)')
      .eq('group_id', groupId)
      .is('ended_at', null),
    supabase
      .from('position_assignments')
      .select('person_id, position_id')
      .eq('group_id', groupId)
      .eq('term_id', termId),
    supabase
      .from('subgroup_members')
      .select('person_id, subgroup_id, subgroups!inner(group_id)')
      .is('left_at', null)
      .eq('subgroups.group_id', groupId),
  ])

  return {
    members: (membersRes.data ?? []).map((m) => ({
      person_id: m.person_id,
      role_type_id: m.role_type_id,
      status_slug: (m.status_definitions as { slug: string })?.slug ?? 'active',
    })),
    positionHolders: (holdersRes.data ?? []).map((h) => ({
      person_id: h.person_id,
      position_id: h.position_id,
    })),
    subgroupMembers: (subMembersRes.data ?? []).map((s) => ({
      person_id: s.person_id,
      subgroup_id: s.subgroup_id,
    })),
  }
}

export type CloneableRequirement = {
  title: string
  description: string | null
  kind: string
  due_at: string | null
  occurs_at: string | null
  amount_cents: number | null
  quota_target: number | null
  quota_unit: string | null
  requires_verification: boolean
  assign_to: string
  audience_role_type_ids: string[] | null
  audience_position_ids: string[] | null
  audience_subgroup_ids: string[] | null
}

export async function getRequirementsForClone(
  supabase: DbClient,
  groupId: string,
  termId: string
): Promise<CloneableRequirement[]> {
  const { data } = await supabase
    .from('requirements')
    .select(
      'title, description, kind, due_at, occurs_at, amount_cents, quota_target, quota_unit, requires_verification, assign_to, audience_role_type_ids, audience_position_ids, audience_subgroup_ids'
    )
    .eq('group_id', groupId)
    .eq('term_id', termId)
    .eq('is_active', true)

  return (data ?? []) as CloneableRequirement[]
}

// --- Progress entries ---

export type ProgressEntryRow = {
  id: string
  assignment_id: string
  amount: number
  occurred_on: string
  note: string | null
  logged_by: string
  logged_by_name: string
  approved_by: string | null
  created_at: string
}

export async function getProgressEntries(
  supabase: DbClient,
  assignmentId: string
): Promise<ProgressEntryRow[]> {
  const { data } = await supabase
    .from('requirement_progress_entries')
    .select('*, persons!requirement_progress_entries_logged_by_fkey(full_name)')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: false })

  if (!data) return []

  return data.map((row) => ({
    id: row.id,
    assignment_id: row.assignment_id,
    amount: row.amount,
    occurred_on: row.occurred_on,
    note: row.note,
    logged_by: row.logged_by,
    logged_by_name: (row.persons as { full_name: string })?.full_name ?? 'Unknown',
    approved_by: row.approved_by,
    created_at: row.created_at,
  }))
}

export async function getPendingEntriesForRequirement(
  supabase: DbClient,
  requirementId: string
): Promise<
  (ProgressEntryRow & {
    person_name: string
    assignment_progress: number
  })[]
> {
  const { data } = await supabase
    .from('requirement_progress_entries')
    .select(
      '*, persons!requirement_progress_entries_logged_by_fkey(full_name), requirement_assignments!inner(person_id, progress, requirement_id, persons!requirement_assignments_person_id_fkey(full_name))'
    )
    .is('approved_by', null)
    .eq('requirement_assignments.requirement_id', requirementId)
    .order('created_at', { ascending: true })

  if (!data) return []

  return data.map((row) => {
    const ra = row.requirement_assignments as unknown as {
      person_id: string
      progress: number
      persons: { full_name: string }
    }
    return {
      id: row.id,
      assignment_id: row.assignment_id,
      amount: row.amount,
      occurred_on: row.occurred_on,
      note: row.note,
      logged_by: row.logged_by,
      logged_by_name: (row.persons as { full_name: string })?.full_name ?? 'Unknown',
      approved_by: row.approved_by,
      created_at: row.created_at,
      person_name: ra.persons?.full_name ?? 'Unknown',
      assignment_progress: ra.progress ?? 0,
    }
  })
}

export async function createProgressEntryDal(
  supabase: DbClient,
  input: {
    assignmentId: string
    amount: number
    occurredOn: string
    note: string | null
    loggedBy: string
    approvedBy: string | null
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('requirement_progress_entries')
    .insert({
      assignment_id: input.assignmentId,
      amount: input.amount,
      occurred_on: input.occurredOn,
      note: input.note,
      logged_by: input.loggedBy,
      approved_by: input.approvedBy,
    })
    .select('id')
    .single()
  if (error) throw new UserFacingError(error.message)

  await recomputeAssignmentProgress(supabase, input.assignmentId)
  return data.id
}

export async function approveProgressEntryDal(
  supabase: DbClient,
  entryId: string,
  approvedBy: string
): Promise<void> {
  const { data: entry, error } = await supabase
    .from('requirement_progress_entries')
    .update({ approved_by: approvedBy })
    .eq('id', entryId)
    .select('assignment_id')
    .single()

  if (error || !entry) throw new UserFacingError(error?.message ?? 'Entry not found')
  await recomputeAssignmentProgress(supabase, entry.assignment_id)
}

export async function rejectProgressEntryDal(supabase: DbClient, entryId: string): Promise<void> {
  const { data: entry, error: fetchErr } = await supabase
    .from('requirement_progress_entries')
    .select('assignment_id')
    .eq('id', entryId)
    .single()

  if (fetchErr || !entry) throw new UserFacingError(fetchErr?.message ?? 'Entry not found')

  const { error } = await supabase.from('requirement_progress_entries').delete().eq('id', entryId)
  if (error) throw new UserFacingError(error.message)

  await recomputeAssignmentProgress(supabase, entry.assignment_id)
}

export async function recomputeAssignmentProgress(
  supabase: DbClient,
  assignmentId: string
): Promise<void> {
  const { data: assignment } = await supabase
    .from('requirement_assignments')
    .select('requirement_id, requirements!inner(kind, amount_cents, quota_target)')
    .eq('id', assignmentId)
    .single()

  if (!assignment) return

  const req = assignment.requirements as unknown as {
    kind: string
    amount_cents: number | null
    quota_target: number | null
  }

  const { data: entries } = await supabase
    .from('requirement_progress_entries')
    .select('amount, approved_by')
    .eq('assignment_id', assignmentId)

  if (!entries) return

  let approvedSum: number
  if (req.kind === 'payment') {
    approvedSum = entries.reduce((sum, e) => sum + e.amount, 0)
  } else {
    approvedSum = entries
      .filter((e) => e.approved_by !== null)
      .reduce((sum, e) => sum + e.amount, 0)
  }

  const target = req.kind === 'payment' ? (req.amount_cents ?? 0) : (req.quota_target ?? 0)
  const isComplete = target > 0 && approvedSum >= target

  const updates: Record<string, unknown> = { progress: approvedSum }
  if (isComplete) {
    updates.status = 'complete'
    updates.completed_at = new Date().toISOString()
  }

  await supabase.from('requirement_assignments').update(updates).eq('id', assignmentId)
}
