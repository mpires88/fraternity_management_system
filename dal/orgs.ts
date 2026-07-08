import type { DbClient } from '@/dal/types'

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
