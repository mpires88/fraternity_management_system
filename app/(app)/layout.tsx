import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Auth guard for all app routes. Middleware handles the redirect but
 * this adds a server-side layer for robustness.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <>{children}</>
}
