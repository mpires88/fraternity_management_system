import type { DbClient } from '@/dal/types'

export type HomeOrg = {
  group_id: string
  org_name: string
  org_slug: string
  org_type: string
  parent_slug: string | null
  role_name: string
  status_name: string
  active_member_count: number
}

/**
 * Loads all orgs a user belongs to, across all parent organizations.
 */
export async function getHomeData(supabase: DbClient, userId: string): Promise<HomeOrg[]> {
  const { data: memberships } = await supabase
    .from('group_memberships')
    .select('group_id, role_types(name), status_definitions(name, slug)')
    .eq('person_id', userId)
    .is('ended_at', null)

  if (!memberships || memberships.length === 0) return []

  const active = memberships.filter((m) => {
    const sd = m.status_definitions as { slug: string } | null
    return sd?.slug !== 'expelled'
  })

  // Deduplicate by group_id (person can have multiple roles in same org)
  const groupIds = [...new Set(active.map((m) => m.group_id))]

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, slug, org_type, parent_organizations(slug)')
    .in('id', groupIds)

  if (!orgs) return []

  // Get active member counts
  const { data: allMembers } = await supabase
    .from('group_memberships')
    .select('group_id, status_definitions(slug)')
    .in('group_id', groupIds)
    .is('ended_at', null)

  const counts: Record<string, number> = {}
  for (const row of allMembers ?? []) {
    const slug = (row.status_definitions as { slug: string })?.slug
    if (slug === 'active') {
      counts[row.group_id] = (counts[row.group_id] ?? 0) + 1
    }
  }

  return orgs.map((o) => {
    const membership = active.find((m) => m.group_id === o.id)
    const at = membership?.role_types as { name: string } | null
    const sd = membership?.status_definitions as { name: string } | null
    const parentSlug = (o.parent_organizations as { slug: string } | null)?.slug ?? null
    return {
      group_id: o.id,
      org_name: o.name,
      org_slug: o.slug,
      org_type: o.org_type,
      parent_slug: parentSlug,
      role_name: at?.name ?? 'Member',
      status_name: sd?.name ?? 'Active',
      active_member_count: counts[o.id] ?? 0,
    }
  })
}
