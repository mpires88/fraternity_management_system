import { redirect } from 'next/navigation'
import { resolvePostLoginRedirect } from '@/dal/orgs'
import { createClient } from '@/lib/supabase/server'

/**
 * Root route — resolves the logged-in user's org and redirects.
 * One org → dashboard. Multiple orgs → unified home.
 */
export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const dest = await resolvePostLoginRedirect(supabase, user.id)

  if (!dest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground">No chapter access</h1>
          <p className="text-sm text-muted-foreground mt-2">
            You don&apos;t belong to any chapter yet. Contact your chapter admin to get an invite.
          </p>
        </div>
      </div>
    )
  }

  redirect(dest)
}
