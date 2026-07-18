import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { Database } from './types'

/**
 * Creates a typed Supabase server client.
 *
 * Reads currentOrgId from the cookie jar and injects it as the
 * x-org-id request header so Postgres RLS policies can scope queries
 * via current_setting('request.headers').
 *
 * Wrapped in React cache() so layout + page share one client per request.
 */
export const createClient = cache(async () => {
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
})

/**
 * Per-request memoized auth lookup. The group layout and every page under it
 * both need the user during one navigation — only the first call hits the
 * Auth endpoint.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
