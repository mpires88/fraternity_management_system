import { notFound, redirect } from 'next/navigation'
import { AdminPanel } from '@/components/admin/admin-panel'
import { getAdminSettings } from '@/dal/admin'
import { getGroupContext } from '@/dal/group-context'
import { isPlatformAdmin } from '@/lib/auth/org-context'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissionsFromContext } from '@/lib/utils/resolve-permissions'

export default async function AdminPage({
  params,
}: {
  params: Promise<{ parent: string; org: string; group: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')
  const perms = resolvePermissionsFromContext(ctx)

  if (perms.access_level !== 'full') notFound()

  const settings = await getAdminSettings(supabase, ctx.group.id)
  if (!settings) notFound()

  const isSuperUser = await isPlatformAdmin(supabase)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-2">Manage {ctx.org.name}</p>
      </div>

      <AdminPanel settings={settings} isSuperUser={isSuperUser} />
    </div>
  )
}
