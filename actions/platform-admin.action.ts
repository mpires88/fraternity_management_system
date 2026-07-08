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
  async (supabase, _user, input: { id: string }) => {
    const isAdmin = await isPlatformAdmin(supabase)
    if (!isAdmin) return { success: false as const, error: 'Not authorized' }
    const org = await getParentOrg(supabase, input.id)
    if (!org) return { success: false as const, error: 'Organization not found' }
    return { success: true as const, data: org }
  }
)

export const updateParentOrg = createAuthenticatedAction(
  async (supabase, _user, input: { id: string } & UpdateParentOrgInput) => {
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

export const getStats = createNoInputQueryAction(async (supabase) => {
  const isAdmin = await isPlatformAdmin(supabase)
  if (!isAdmin) return { parentOrgs: 0, organizations: 0, groups: 0, persons: 0 }
  return getPlatformStats(supabase)
}, 'Failed to load stats')
