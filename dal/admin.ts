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
}

export async function getAdminSettings(
  supabase: DbClient,
  groupId: string
): Promise<AdminSettingsData | null> {
  // Look up the organization via the group
  const { data: group } = await supabase
    .from('groups')
    .select('organization_id')
    .eq('id', groupId)
    .single()

  if (!group) return null

  const [orgRes, affRes, statusRes, posRes, termRes] = await Promise.all([
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
  ])

  if (!orgRes.data) return null

  return {
    org: {
      ...orgRes.data,
      features: (orgRes.data.features ?? {}) as Record<string, boolean>,
    },
    roleTypes: (affRes.data ?? []) as AdminSettingsData['roleTypes'],
    statusDefinitions: (statusRes.data ?? []) as AdminSettingsData['statusDefinitions'],
    positions: (posRes.data ?? []) as AdminSettingsData['positions'],
    termDefinitions: (termRes.data ?? []) as AdminSettingsData['termDefinitions'],
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

  const { error } = await supabase
    .from('organizations')
    .update({ name: input.name, features: input.features })
    .eq('id', group.organization_id)

  if (error) throw new UserFacingError(error.message)
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
