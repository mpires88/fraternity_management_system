import type { DbClient } from '@/dal/types'
import type { ActiveRole, ParentOrgInfo } from '@/lib/context/org-context'
import type { Org, OrgMembership, Person, RoleType, StatusDefinition } from '@/lib/types/db'

export type Group = {
  id: string
  organization_id: string
  name: string
  slug: string
  group_type: string | null
  features: Record<string, boolean>
  settings: Record<string, unknown>
  terminology: Record<string, string>
  is_primary: boolean
  logo_url: string | null
  created_at: string
}

export type GroupContextData = {
  parentOrg: ParentOrgInfo | null
  org: Org
  group: Group
  person: Person
  roles: ActiveRole[]
  allGroups: Array<{ group: Group; parentSlug: string | null; orgSlug: string }>
}

/**
 * Loads context for a group within an org under a parent.
 * URL: /[parentSlug]/[orgSlug]/[groupSlug]/...
 */
export async function getGroupContext(
  supabase: DbClient,
  slugs: { parentSlug: string; orgSlug: string; groupSlug: string },
  userId: string
): Promise<GroupContextData | null> {
  // Look up parent org
  const { data: parentOrg } = await supabase
    .from('parent_organizations')
    .select('id, name, slug')
    .eq('slug', slugs.parentSlug)
    .single()

  // For independent orgs, parentSlug = orgSlug (no parent org exists)
  const parentOrgInfo: ParentOrgInfo | null = parentOrg

  // Look up organization
  let orgQuery = supabase.from('organizations').select('*').eq('slug', slugs.orgSlug)
  if (parentOrg) {
    orgQuery = orgQuery.eq('parent_organization_id', parentOrg.id)
  } else {
    // Independent org: parentSlug IS the org slug
    orgQuery = supabase.from('organizations').select('*').eq('slug', slugs.parentSlug)
  }
  const { data: org } = await orgQuery.single()
  if (!org) return null

  // Look up group
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('organization_id', org.id)
    .eq('slug', slugs.groupSlug)
    .single()
  if (!group) return null

  // Person (platform-level)
  const { data: person } = await supabase.from('persons').select('*').eq('id', userId).single()
  if (!person) return null

  // Active roles in this group
  const { data: membershipRows } = await supabase
    .from('group_memberships')
    .select('*, role_types(*), status_definitions(*)')
    .eq('person_id', userId)
    .eq('group_id', group.id)
    .is('ended_at', null)

  if (!membershipRows || membershipRows.length === 0) return null

  const roles: ActiveRole[] = membershipRows
    .map((row) => {
      const r = row as unknown as OrgMembership & {
        role_types: RoleType
        status_definitions: StatusDefinition
      }
      if (!r.role_types || !r.status_definitions) return null
      if (r.status_definitions.slug === 'expelled') return null
      const { role_types, status_definitions, ...membership } = r
      return {
        membership: membership as unknown as OrgMembership,
        roleType: role_types,
        statusDefinition: status_definitions,
      }
    })
    .filter((r): r is ActiveRole => r !== null)

  if (roles.length === 0) return null

  // All groups this person belongs to (for the group switcher)
  const { data: allMembershipRows } = await supabase
    .from('group_memberships')
    .select('group_id, groups(*, organizations(slug, parent_organizations(slug)))')
    .eq('person_id', userId)
    .is('ended_at', null)

  const seenGroups = new Set<string>()
  const allGroups = (allMembershipRows ?? [])
    .filter((row) => {
      const gid = row.group_id
      if (seenGroups.has(gid)) return false
      seenGroups.add(gid)
      return true
    })
    .map((row) => {
      const g = row.groups as unknown as Group & {
        organizations: { slug: string; parent_organizations: { slug: string } | null }
      }
      return {
        group: g as unknown as Group,
        parentSlug: g.organizations?.parent_organizations?.slug ?? null,
        orgSlug: g.organizations?.slug ?? '',
      }
    })

  return {
    parentOrg: parentOrgInfo,
    org: org as unknown as Org,
    group: group as unknown as Group,
    person: person as unknown as Person,
    roles,
    allGroups,
  }
}
