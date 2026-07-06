'use server'

import { resolvePostLoginRedirect } from '@/dal/orgs'
import { createClient } from '@/lib/supabase/server'

export async function loginAction(
  email: string,
  password: string
): Promise<{ success: boolean; redirect?: string; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { success: false, error: error.message }
  }

  const dest = await resolvePostLoginRedirect(
    supabase,
    (await supabase.auth.getUser()).data.user!.id
  )

  return { success: true, redirect: dest ?? '/' }
}
