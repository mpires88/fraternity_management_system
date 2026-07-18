import type { DbClient } from '@/dal/types'

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
