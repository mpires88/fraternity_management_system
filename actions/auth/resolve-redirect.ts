'use server'

import { resolvePostLoginRedirect } from '@/dal/orgs'
import { createClient } from '@/lib/supabase/server'

/**
 * Called after successful login to determine where to send the user.
 */
export async function resolveLoginRedirect(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  return resolvePostLoginRedirect(supabase, user.id)
}
