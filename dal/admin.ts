import type { DbClient } from '@/dal/types'

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
  const [orgRes, affRes, statusRes, posRes, termRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, slug, org_type, features')
      .eq('id', groupId)
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
