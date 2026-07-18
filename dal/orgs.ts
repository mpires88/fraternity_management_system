import type { DbClient } from '@/dal/types'
import type { GroupSlugPath } from '@/lib/utils/hrefs'

/**
 * Resolves a group's URL slugs (parent org / org / group) for building
 * group-scoped hrefs. Returns null if the chain is incomplete.
 */
export async function getGroupSlugPathDal(
  supabase: DbClient,
  groupId: string
): Promise<GroupSlugPath | null> {
  const { data } = await supabase
    .from('groups')
    .select('slug, organizations(slug, parent_organizations(slug))')
    .eq('id', groupId)
    .maybeSingle()

  const org = data?.organizations as {
    slug: string
    parent_organizations: { slug: string } | null
  } | null
  if (!data || !org?.parent_organizations) return null

  return {
    parentSlug: org.parent_organizations.slug,
    orgSlug: org.slug,
    groupSlug: data.slug,
  }
}

export interface GroupPickerGroup {
  id: string
  name: string
  slug: string
  group_type: string | null
  roleName: string
  statusName: string
  memberCount: number
}

export interface GroupPickerData {
  parentOrgName: string | null
  orgName: string
  groups: GroupPickerGroup[]
}

/**
 * Data for the group picker landing page: the org's groups the person
 * actually belongs to (active, non-expelled), with role/status labels and
 * member counts. Person is resolved via persons.auth_user_id — never assume
 * persons.id equals the auth uid.
 */
export async function getGroupPickerDataDal(
  supabase: DbClient,
  authUserId: string,
  parentSlug: string,
  orgSlug: string
): Promise<GroupPickerData | null> {
  const { data: parentOrg } = await supabase
    .from('parent_organizations')
    .select('id, name')
    .eq('slug', parentSlug)
    .single()
  if (!parentOrg) return null

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('parent_organization_id', parentOrg.id)
    .eq('slug', orgSlug)
    .single()
  if (!org) return null

  const { data: personRow } = await supabase
    .from('persons')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (!personRow) return { parentOrgName: parentOrg.name, orgName: org.name, groups: [] }

  const { data: memberships } = await supabase
    .from('group_memberships')
    .select('group_id, role_types(name), status_definitions(name, slug)')
    .eq('person_id', personRow.id)
    .is('ended_at', null)

  const active = (memberships ?? []).filter(
    (m) => (m.status_definitions as { slug: string } | null)?.slug !== 'expelled'
  )
  const activeGroupIds = [...new Set(active.map((m) => m.group_id))]
  if (activeGroupIds.length === 0) {
    return { parentOrgName: parentOrg.name, orgName: org.name, groups: [] }
  }

  const [{ data: groups }, { data: allMembers }] = await Promise.all([
    supabase
      .from('groups')
      .select('id, name, slug, group_type, is_primary')
      .eq('organization_id', org.id)
      .in('id', activeGroupIds)
      .order('is_primary', { ascending: false }),
    supabase
      .from('group_memberships')
      .select('group_id, status_definitions(slug)')
      .in('group_id', activeGroupIds)
      .is('ended_at', null),
  ])

  const counts: Record<string, number> = {}
  for (const m of allMembers ?? []) {
    if ((m.status_definitions as { slug: string } | null)?.slug !== 'expelled') {
      counts[m.group_id] = (counts[m.group_id] ?? 0) + 1
    }
  }

  return {
    parentOrgName: parentOrg.name,
    orgName: org.name,
    groups: (groups ?? []).map((g) => {
      const membership = active.find((m) => m.group_id === g.id)
      return {
        id: g.id,
        name: g.name,
        slug: g.slug,
        group_type: g.group_type,
        roleName: (membership?.role_types as { name: string } | null)?.name ?? 'Member',
        statusName: (membership?.status_definitions as { name: string } | null)?.name ?? 'Active',
        memberCount: counts[g.id] ?? 0,
      }
    }),
  }
}

/**
 * Resolves where to send a newly-logged-in user.
 *
 * One group  → /[parent]/[org]/[group]/dashboard
 * Multiple groups in same org → /[parent]/[org] (landing page to choose)
 * Multiple orgs → /[parent]/[org] of the first one (for now)
 */
export async function resolvePostLoginRedirect(
  supabase: DbClient,
  userId: string
): Promise<string | null> {
  // Resolve person_id from auth_user_id
  const { data: personRow } = await supabase
    .from('persons')
    .select('id')
    .eq('auth_user_id', userId)
    .single()
  if (!personRow) return null

  const { data: memberships } = await supabase
    .from('group_memberships')
    .select('group_id, status_definitions(slug)')
    .eq('person_id', personRow.id)
    .is('ended_at', null)

  const active = (memberships ?? []).filter((m) => {
    const sd = m.status_definitions as { slug: string } | null
    return sd?.slug !== 'expelled'
  })

  if (active.length === 0) return null

  // Get all groups with their org info
  const groupIds = [...new Set(active.map((m) => m.group_id))]

  const { data: groups } = await supabase
    .from('groups')
    .select('id, slug, organization_id, organizations(slug, parent_organizations(slug))')
    .in('id', groupIds)

  if (!groups || groups.length === 0) return null

  // Build the org URL base
  const firstGroup = groups[0]
  const org = firstGroup.organizations as {
    slug: string
    parent_organizations: { slug: string } | null
  }
  const parentSlug = org.parent_organizations?.slug
  const basePath = parentSlug ? `/${parentSlug}/${org.slug}` : `/${org.slug}/${org.slug}`

  // Check if multiple groups in the same org
  const orgId = firstGroup.organization_id
  const groupsInSameOrg = groups.filter((g) => g.organization_id === orgId)

  if (groupsInSameOrg.length === 1) {
    // Single group → go directly to dashboard
    return `${basePath}/${firstGroup.slug}/dashboard`
  }

  // Multiple groups → landing page to choose
  return basePath
}
