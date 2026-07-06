'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type SupabaseContext = {
  supabase: SupabaseClient
}

const Context = createContext<SupabaseContext | null>(null)

/**
 * Provides a singleton Supabase client for client components.
 * Listens for auth state changes and refreshes the page on sign-out
 * so server components re-evaluate auth.
 */
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
        router.refresh()
      }
      if (event === 'TOKEN_REFRESHED') {
        router.refresh()
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  return <Context.Provider value={{ supabase }}>{children}</Context.Provider>
}

export function useSupabase(): SupabaseClient {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useSupabase must be used within SupabaseProvider')
  return ctx.supabase
}
