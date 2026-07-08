import type { DbClient } from '@/dal/types'

export type ParentOrgRow = {
  id: string
  name: string
  abbreviation: string | null
  slug: string
  org_type: string
  logo_url: string | null
  website: string | null
  founded_year: number | null
  primary_color: string | null
  secondary_color: string | null
  status: string | null
}

export type OrgRow = {
  id: string
  name: string
  slug: string
  org_type: string
  parent_organization_id: string | null
  parent_organizations: { name: string; slug: string } | null
}

export type PlatformAdminRow = {
  id: string
  email: string
  created_at: string
}

export async function listParentOrgs(supabase: DbClient): Promise<ParentOrgRow[]> {
  const { data } = await supabase.from('parent_organizations').select('*').order('name')
  return (data ?? []) as ParentOrgRow[]
}

export async function getParentOrg(supabase: DbClient, id: string): Promise<ParentOrgRow | null> {
  const { data } = await supabase.from('parent_organizations').select('*').eq('id', id).single()
  return (data as ParentOrgRow) ?? null
}

export type UpdateParentOrgInput = {
  name?: string
  abbreviation?: string | null
  primary_color?: string | null
  secondary_color?: string | null
  logo_url?: string | null
  website?: string | null
}

export async function updateParentOrgDal(
  supabase: DbClient,
  id: string,
  input: UpdateParentOrgInput
): Promise<ParentOrgRow | null> {
  const { data } = await supabase
    .from('parent_organizations')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  return (data as ParentOrgRow) ?? null
}

export async function listOrganizations(supabase: DbClient): Promise<OrgRow[]> {
  const { data } = await supabase
    .from('organizations')
    .select('id, name, slug, org_type, parent_organization_id, parent_organizations(name, slug)')
    .order('name')
  return (data ?? []) as OrgRow[]
}

export async function listPlatformAdmins(supabase: DbClient): Promise<PlatformAdminRow[]> {
  const { data } = await supabase.from('platform_admins').select('*').order('email')
  return (data ?? []) as PlatformAdminRow[]
}

export async function getPlatformStats(supabase: DbClient) {
  const [parentOrgs, orgs, groups, persons] = await Promise.all([
    supabase.from('parent_organizations').select('id', { count: 'exact', head: true }),
    supabase.from('organizations').select('id', { count: 'exact', head: true }),
    supabase.from('groups').select('id', { count: 'exact', head: true }),
    supabase.from('persons').select('id', { count: 'exact', head: true }),
  ])
  return {
    parentOrgs: parentOrgs.count ?? 0,
    organizations: orgs.count ?? 0,
    groups: groups.count ?? 0,
    persons: persons.count ?? 0,
  }
}
