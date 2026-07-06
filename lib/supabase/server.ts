import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

/**
 * Creates a typed Supabase server client.
 *
 * Reads currentOrgId from the cookie jar and injects it as the
 * x-org-id request header so Postgres RLS policies can scope queries
 * via current_setting('request.headers').
 */
export async function createClient() {
  const cookieStore = await cookies()
  const currentOrgId = cookieStore.get('currentOrgId')?.value

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Called from middleware — safe to ignore.
          }
        },
      },
      global: {
        headers: currentOrgId ? { 'x-org-id': currentOrgId } : {},
      },
    }
  )
}
