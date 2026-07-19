'use server'

import { createAuthenticatedAction, createNoInputQueryAction } from '@/actions/utils/action-helpers'
import type { UpdateParentOrgInput } from '@/dal/platform-admin'
import {
  getParentOrg,
  getPlatformStats,
  listOrganizations,
  listParentOrgs,
  listPlatformAdmins,
  updateParentOrgDal,
} from '@/dal/platform-admin'
import { isPlatformAdmin } from '@/lib/auth/org-context'

export const getParentOrgs = createNoInputQueryAction(async (supabase) => {
  const isAdmin = await isPlatformAdmin(supabase)
  if (!isAdmin) return []
  return listParentOrgs(supabase)
}, 'Failed to load organizations')

export const getParentOrgById = createAuthenticatedAction(
  async (supabase, _actor, input: { id: string }) => {
    const isAdmin = await isPlatformAdmin(supabase)
    if (!isAdmin) return { success: false as const, error: 'Not authorized' }
    const org = await getParentOrg(supabase, input.id)
    if (!org) return { success: false as const, error: 'Organization not found' }
    return { success: true as const, data: org }
  }
)

export const updateParentOrg = createAuthenticatedAction(
  async (supabase, _actor, input: { id: string } & UpdateParentOrgInput) => {
    const isAdmin = await isPlatformAdmin(supabase)
    if (!isAdmin) return { success: false as const, error: 'Not authorized' }
    const { id, ...updates } = input
    const org = await updateParentOrgDal(supabase, id, updates)
    if (!org) return { success: false as const, error: 'Failed to update' }
    return { success: true as const, data: org }
  }
)

export const getOrganizations = createNoInputQueryAction(async (supabase) => {
  const isAdmin = await isPlatformAdmin(supabase)
  if (!isAdmin) return []
  return listOrganizations(supabase)
}, 'Failed to load organizations')

export const getPlatformAdmins = createNoInputQueryAction(async (supabase) => {
  const isAdmin = await isPlatformAdmin(supabase)
  if (!isAdmin) return []
  return listPlatformAdmins(supabase)
}, 'Failed to load admins')

export type OrgSwitcherOrg = {
  id: string
  name: string
  slug: string
  parentSlug: string | null
  groups: { id: string; name: string; slug: string }[]
}

/** Data for the platform-admin org/group switchers in the sidebar. */
export const getOrgSwitcherData = createNoInputQueryAction<OrgSwitcherOrg[]>(async (supabase) => {
  const isAdmin = await isPlatformAdmin(supabase)
  if (!isAdmin) return []

  const [{ data: orgs }, { data: groups }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, slug, parent_organizations(slug)')
      .order('name'),
    supabase.from('groups').select('id, name, slug, organization_id, is_primary'),
  ])

  return (orgs ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    parentSlug: (o.parent_organizations as { slug: string } | null)?.slug ?? null,
    groups: (groups ?? [])
      .filter((g) => g.organization_id === o.id)
      .sort((a, b) => Number(b.is_primary ?? false) - Number(a.is_primary ?? false))
      .map((g) => ({ id: g.id, name: g.name, slug: g.slug })),
  }))
}, 'Failed to load organizations')

export const getStats = createNoInputQueryAction(async (supabase) => {
  const isAdmin = await isPlatformAdmin(supabase)
  if (!isAdmin) return { parentOrgs: 0, organizations: 0, groups: 0, persons: 0 }
  return getPlatformStats(supabase)
}, 'Failed to load stats')
