import { cookies } from 'next/headers'
import type { DbClient } from '@/dal/types'

/**
 * Reads the current org ID from the cookie and validates the user
 * actually has a membership in that org. Returns null if invalid.
 */
export async function getCurrentOrgId(supabase?: DbClient): Promise<string | null> {
  const cookieStore = await cookies()
  const groupId = cookieStore.get('currentOrgId')?.value ?? null

  if (!groupId || !supabase) return groupId

  // Validate membership exists
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('group_memberships')
    .select('id, status_definitions(slug)')
    .eq('person_id', user.id)
    .eq('group_id', groupId)
    .limit(1)
    .single()

  // Reject expelled members
  const sd = data?.status_definitions as { slug: string } | null
  if (sd?.slug === 'expelled') return null

  return data ? groupId : null
}

/**
 * Checks if the current user is a platform admin.
 */
export async function isPlatformAdmin(supabase: DbClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('id', user.id)
    .limit(1)
    .single()

  return !!data
}
