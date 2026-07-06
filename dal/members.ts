import type { DbClient } from '@/dal/types'
import type { OrgMembership, Person, RoleType, StatusDefinition } from '@/lib/types/db'

export type MemberRow = OrgMembership & {
  person: Person
  role_type: RoleType
  status_definition: StatusDefinition
  /** @deprecated Use role_type */
  membership_type: RoleType
}

/**
 * Returns all members for an org, with person, role, and status data.
 * Excludes expelled members.
 */
export async function getMembersByOrg(supabase: DbClient, groupId: string): Promise<MemberRow[]> {
  const { data } = await supabase
    .from('group_memberships')
    .select('*, persons(*), role_types(*), status_definitions(*)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })

  if (!data) return []

  return data
    .filter((row) => {
      const sd = (row as { status_definitions: { slug: string } }).status_definitions
      return sd?.slug !== 'expelled'
    })
    .map((row) => {
      const r = row as unknown as OrgMembership & {
        persons: Person
        role_types: RoleType
        status_definitions: StatusDefinition
      }
      const {
        persons: person,
        role_types: role_type,
        status_definitions: status_definition,
        ...membership
      } = r
      return {
        ...membership,
        person,
        role_type,
        status_definition,
        membership_type: role_type, // backwards compat
      } as MemberRow
    })
}
