import type { DbClient } from '@/dal/types'

export type RoleHolder = {
  personId: string
  fullName: string
  positionTitle: string
}

/**
 * Finds who currently holds a system role (e.g. 'treasurer', 'presiding_officer')
 * in an org. Uses the current_system_role_holders view for active assignments,
 * falls back to the latest term's assignments.
 */
export async function getCurrentRoleHolder(
  supabase: DbClient,
  groupId: string,
  systemRoleSlug: string
): Promise<RoleHolder | null> {
  // Try the view first (assignments with no term_end)
  const { data: viewRow } = await supabase
    .from('current_system_role_holders')
    .select('person_id, full_name, position_title')
    .eq('group_id', groupId)
    .eq('system_role', systemRoleSlug)
    .limit(1)
    .single()

  if (viewRow && viewRow.person_id && viewRow.full_name && viewRow.position_title) {
    return {
      personId: viewRow.person_id,
      fullName: viewRow.full_name,
      positionTitle: viewRow.position_title,
    }
  }

  // Fallback: find from the latest term with assignments
  const { data: assignment } = await supabase
    .from('position_assignments')
    .select(
      'person_id, persons!position_assignments_person_id_fkey(full_name), positions!inner(title, system_role_id, system_position_roles!inner(slug))'
    )
    .eq('group_id', groupId)
    .eq('positions.system_position_roles.slug', systemRoleSlug)
    .order('term_id', { ascending: false })
    .limit(1)
    .single()

  if (!assignment) return null

  const person = assignment.persons as { full_name: string }
  const position = assignment.positions as { title: string }

  return {
    personId: assignment.person_id,
    fullName: person.full_name,
    positionTitle: position.title,
  }
}

/**
 * Returns all current role holders for an org.
 */
export async function getAllCurrentRoleHolders(
  supabase: DbClient,
  groupId: string
): Promise<RoleHolder[]> {
  const { data } = await supabase
    .from('current_system_role_holders')
    .select('person_id, full_name, position_title')
    .eq('group_id', groupId)

  return (data ?? [])
    .filter((r) => r.person_id && r.full_name && r.position_title)
    .map((r) => ({
      personId: r.person_id!,
      fullName: r.full_name!,
      positionTitle: r.position_title!,
    }))
}
