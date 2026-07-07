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
