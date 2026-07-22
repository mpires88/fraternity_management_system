import type { DbClient } from '@/dal/types'
import { UserFacingError } from '@/lib/errors'

export type AdminSettingsData = {
  org: {
    id: string
    name: string
    slug: string
    org_type: string
    features: Record<string, boolean>
  }
  roleTypes: {
    id: string
    name: string
    slug: string
    access_level: string
    can_vote: boolean | null
    can_hold_office: boolean | null
    can_attend_events: boolean | null
    can_view_roster: boolean | null
    can_view_financials: boolean | null
    can_submit_expenses: boolean | null
    can_view_minutes: boolean | null
    can_speak_at_meetings: boolean | null
    can_view_documents: boolean | null
    color: string | null
    display_order: number | null
    is_default: boolean | null
  }[]
  statusDefinitions: {
    id: string
    name: string
    slug: string
    is_base: boolean | null
    group_id: string | null
    color: string | null
    display_order: number | null
    override_access_level: string | null
    override_can_vote: boolean | null
    override_can_hold_office: boolean | null
    override_can_attend_events: boolean | null
  }[]
  positions: {
    id: string
    title: string
    slug: string
    type: string | null
    permission_level: string | null
    system_role_id: string | null
    officer_selection: string | null
    has_budget: boolean | null
    is_presiding_officer: boolean | null
    max_holders: number | null
    display_order: number | null
    is_locked: boolean | null
  }[]
  termDefinitions: {
    id: string
    name: string
    slug: string
    ordinal: number
    start_month: number
    start_day: number
    end_month: number
    end_day: number
    has_elections: boolean | null
    has_budget: boolean | null
    has_rush: boolean | null
    is_active: boolean | null
  }[]
  terms: {
    id: string
    name: string
    definition_id: string
    year: number
    starts_on: string
    ends_on: string
    status: string | null
  }[]
}

export async function getAdminSettings(
  supabase: DbClient,
  groupId: string
): Promise<AdminSettingsData | null> {
  // Look up the group (features live here — per-group, not per-org) + its org
  const { data: group } = await supabase
    .from('groups')
    .select('organization_id, features')
    .eq('id', groupId)
    .single()

  if (!group) return null

  const [orgRes, affRes, statusRes, posRes, termDefRes, termsRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, slug, org_type, features')
      .eq('id', group.organization_id)
      .single(),
    supabase.from('role_types').select('*').eq('group_id', groupId).order('display_order'),
    supabase
      .from('status_definitions')
      .select('*')
      .or(`group_id.eq.${groupId},group_id.is.null`)
      .order('display_order'),
    supabase.from('positions').select('*').eq('group_id', groupId).order('display_order'),
    supabase.from('term_definitions').select('*').eq('group_id', groupId).order('ordinal'),
    supabase
      .from('terms')
      .select('id, name, definition_id, year, starts_on, ends_on, status')
      .eq('group_id', groupId)
      .order('year', { ascending: false })
      .order('starts_on', { ascending: false }),
  ])

  if (!orgRes.data) return null

  return {
    org: {
      ...orgRes.data,
      // Features are group-scoped — the sidebar reads the group's flags
      features: (group.features ?? {}) as Record<string, boolean>,
    },
    roleTypes: (affRes.data ?? []) as AdminSettingsData['roleTypes'],
    statusDefinitions: (statusRes.data ?? []) as AdminSettingsData['statusDefinitions'],
    positions: (posRes.data ?? []) as AdminSettingsData['positions'],
    termDefinitions: (termDefRes.data ?? []) as AdminSettingsData['termDefinitions'],
    terms: (termsRes.data ?? []) as AdminSettingsData['terms'],
  }
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export async function updateOrgDetailsDal(
  supabase: DbClient,
  groupId: string,
  input: { name: string; features: Record<string, boolean> }
): Promise<void> {
  const { data: group } = await supabase
    .from('groups')
    .select('organization_id')
    .eq('id', groupId)
    .single()

  if (!group) throw new UserFacingError('Group not found')

  // Features are per-group (chapter vs housing corp vs alumni differ, and the
  // sidebar reads the group's flags); the name stays on the organization.
  const { error: featError } = await supabase
    .from('groups')
    .update({ features: input.features })
    .eq('id', groupId)
  if (featError) throw new UserFacingError(featError.message)

  const { error: nameError } = await supabase
    .from('organizations')
    .update({ name: input.name })
    .eq('id', group.organization_id)
  if (nameError) throw new UserFacingError(nameError.message)
}

export async function upsertRoleTypeDal(
  supabase: DbClient,
  groupId: string,
  input: {
    id?: string
    name: string
    slug: string
    access_level: string
    can_vote: boolean
    can_hold_office: boolean
    can_attend_events: boolean
    can_view_roster: boolean
    can_view_financials: boolean
    can_submit_expenses: boolean
    can_view_minutes: boolean
    can_speak_at_meetings: boolean
    can_view_documents: boolean
    color: string | null
    display_order: number
    is_default: boolean
  }
): Promise<void> {
  const { id, ...fields } = input

  const { error } = id
    ? await supabase
        .from('role_types')
        .update({ ...fields, group_id: groupId })
        .eq('id', id)
    : await supabase.from('role_types').insert({ ...fields, group_id: groupId })

  if (error) throw new UserFacingError(error.message)
}

export async function deleteRoleTypeDal(supabase: DbClient, id: string): Promise<void> {
  const { error } = await supabase.from('role_types').delete().eq('id', id)
  if (error) throw new UserFacingError(error.message)
}

export async function upsertStatusDefinitionDal(
  supabase: DbClient,
  groupId: string,
  input: {
    id?: string
    name: string
    slug: string
    description?: string
    color: string | null
    display_order: number
    override_access_level: string | null
    override_can_vote: boolean | null
    override_can_hold_office: boolean | null
    override_can_attend_events: boolean | null
  }
): Promise<void> {
  const { id, ...fields } = input

  const { error } = id
    ? await supabase
        .from('status_definitions')
        .update({ ...fields, group_id: groupId, is_base: false })
        .eq('id', id)
    : await supabase
        .from('status_definitions')
        .insert({ ...fields, group_id: groupId, is_base: false })

  if (error) throw new UserFacingError(error.message)
}

export async function deleteStatusDefinitionDal(supabase: DbClient, id: string): Promise<void> {
  const { data: sd } = await supabase
    .from('status_definitions')
    .select('is_base')
    .eq('id', id)
    .single()
  if (sd?.is_base) throw new UserFacingError('Cannot delete base status')

  const { error } = await supabase.from('status_definitions').delete().eq('id', id)
  if (error) throw new UserFacingError(error.message)
}

export async function upsertPositionDal(
  supabase: DbClient,
  groupId: string,
  input: {
    id?: string
    title: string
    slug: string
    type: string
    permission_level: string
    officer_selection: string
    has_budget: boolean
    display_order: number
  }
): Promise<void> {
  const { id, ...fields } = input

  const { error } = id
    ? await supabase
        .from('positions')
        .update({ ...fields, group_id: groupId })
        .eq('id', id)
    : await supabase.from('positions').insert({ ...fields, group_id: groupId })

  if (error) throw new UserFacingError(error.message)
}

export async function deletePositionDal(supabase: DbClient, id: string): Promise<void> {
  const { data: pos } = await supabase.from('positions').select('is_locked').eq('id', id).single()
  if (pos?.is_locked) throw new UserFacingError('Cannot delete locked position')

  const { error } = await supabase.from('positions').delete().eq('id', id)
  if (error) throw new UserFacingError(error.message)
}

// ── Term Definitions ──────────────────────────────────────────────────────────

export async function upsertTermDefinitionDal(
  supabase: DbClient,
  groupId: string,
  input: {
    id?: string
    name: string
    slug: string
    ordinal: number
    start_month: number
    start_day: number
    end_month: number
    end_day: number
    has_elections: boolean
    has_budget: boolean
    has_rush: boolean
  }
): Promise<void> {
  const { id, ...fields } = input

  const { error } = id
    ? await supabase
        .from('term_definitions')
        .update({ ...fields, group_id: groupId })
        .eq('id', id)
    : await supabase.from('term_definitions').insert({ ...fields, group_id: groupId })

  if (error) throw new UserFacingError(error.message)
}

export async function deleteTermDefinitionDal(supabase: DbClient, id: string): Promise<void> {
  const { count } = await supabase
    .from('terms')
    .select('id', { count: 'exact', head: true })
    .eq('definition_id', id)

  if (count && count > 0) {
    throw new UserFacingError('Cannot delete a term definition that has terms created from it')
  }

  const { error } = await supabase.from('term_definitions').delete().eq('id', id)
  if (error) throw new UserFacingError(error.message)
}

// ── Terms ─────────────────────────────────────────────────────────────────────

export async function createTermDal(
  supabase: DbClient,
  groupId: string,
  input: {
    definition_id: string
    name: string
    year: number
    starts_on: string
    ends_on: string
  }
): Promise<void> {
  const { data: def } = await supabase
    .from('term_definitions')
    .select('has_elections, has_budget, has_rollover, has_rush, officer_selection')
    .eq('id', input.definition_id)
    .single()

  if (!def) throw new UserFacingError('Term definition not found')

  const { error } = await supabase.from('terms').insert({
    group_id: groupId,
    definition_id: input.definition_id,
    name: input.name,
    year: input.year,
    starts_on: input.starts_on,
    ends_on: input.ends_on,
    status: 'upcoming',
    has_elections: def.has_elections ?? true,
    has_budget: def.has_budget ?? true,
    has_rollover: def.has_rollover ?? true,
    has_rush: def.has_rush ?? false,
    officer_selection: def.officer_selection ?? 'elected',
  })

  if (error) throw new UserFacingError(error.message)
}

export async function activateTermDal(
  supabase: DbClient,
  groupId: string,
  termId: string
): Promise<void> {
  const { error: deactivateError } = await supabase
    .from('terms')
    .update({ status: 'completed' })
    .eq('group_id', groupId)
    .eq('status', 'active')

  if (deactivateError) throw new UserFacingError(deactivateError.message)

  const { error } = await supabase
    .from('terms')
    .update({ status: 'active' })
    .eq('id', termId)
    .eq('group_id', groupId)

  if (error) throw new UserFacingError(error.message)
}
