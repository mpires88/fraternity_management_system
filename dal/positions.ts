import type { DbClient } from '@/dal/types'

export type SystemRoleFlags = {
  is_rush_chair: boolean
  is_treasurer: boolean
  is_house_manager: boolean
}

/**
 * Returns the system_position_roles flags for a person's active position
 * assignments in a group. Used to resolve module-level permissions (9.2).
 */
export async function getActiveSystemRolesForPersonDal(
  supabase: DbClient,
  personId: string,
  groupId: string
): Promise<SystemRoleFlags[]> {
  const { data } = await supabase
    .from('position_assignments')
    .select('positions!inner(system_position_roles(is_rush_chair, is_treasurer, is_house_manager))')
    .eq('person_id', personId)
    .eq('group_id', groupId)
    .is('term_end', null)

  if (!data) return []

  return data
    .map((row) => {
      const pos = row.positions as unknown as {
        system_position_roles: SystemRoleFlags | null
      }
      return pos?.system_position_roles ?? null
    })
    .filter((r): r is SystemRoleFlags => r !== null)
}

export type PositionRow = {
  id: string
  title: string
  slug: string | null
  type: string | null
  has_budget: boolean
  max_holders: number | null
  display_order: number | null
}

export type PositionHolder = {
  position_id: string
  person_id: string
  person_name: string
  is_acting: boolean
}

export async function getPositionsForGroupDal(
  supabase: DbClient,
  groupId: string
): Promise<PositionRow[]> {
  const { data } = await supabase
    .from('positions')
    .select('id, title, slug, type, has_budget, max_holders, display_order')
    .eq('group_id', groupId)
    .order('display_order', { ascending: true })
  return (data ?? []) as PositionRow[]
}

/** Positions flagged has_budget — each holder submits a budget proposal. */
export async function getBudgetedPositionsDal(
  supabase: DbClient,
  groupId: string
): Promise<PositionRow[]> {
  const { data } = await supabase
    .from('positions')
    .select('id, title, slug, type, has_budget, max_holders, display_order')
    .eq('group_id', groupId)
    .eq('has_budget', true)
    .order('display_order', { ascending: true })
  return (data ?? []) as PositionRow[]
}

/**
 * Current holders of positions whose system role carries is_treasurer —
 * the notification audience for budget/reimbursement events. One query,
 * not a per-member role scan.
 */
export async function getTreasurerPersonIdsDal(
  supabase: DbClient,
  groupId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('position_assignments')
    .select('person_id, positions!inner(system_position_roles!inner(is_treasurer))')
    .eq('group_id', groupId)
    .is('term_end', null)
    .eq('positions.system_position_roles.is_treasurer', true)
  return [...new Set((data ?? []).map((row) => row.person_id))]
}

/** Current holders (term_end IS NULL) of a group's positions. */
export async function getActivePositionHoldersDal(
  supabase: DbClient,
  groupId: string
): Promise<PositionHolder[]> {
  const { data } = await supabase
    .from('position_assignments')
    .select(
      'position_id, person_id, is_acting, persons!position_assignments_person_id_fkey(full_name)'
    )
    .eq('group_id', groupId)
    .is('term_end', null)

  return (data ?? []).map((row) => ({
    position_id: row.position_id,
    person_id: row.person_id,
    person_name: (row.persons as { full_name: string } | null)?.full_name ?? 'Unknown',
    is_acting: row.is_acting ?? false,
  }))
}
