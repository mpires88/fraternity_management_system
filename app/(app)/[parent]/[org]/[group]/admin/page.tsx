import { notFound, redirect } from 'next/navigation'
import { AdminPanel } from '@/components/admin/admin-panel'
import { PageHeader } from '@/components/ui/page-header'
import { getAdminSettings } from '@/dal/admin'
import { getPendingChangeRequests } from '@/dal/change-requests'
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

  const [settings, changeRequests, isSuperUser] = await Promise.all([
    getAdminSettings(supabase, ctx.group.id),
    getPendingChangeRequests(supabase, ctx.group.id),
    isPlatformAdmin(supabase),
  ])
  if (!settings) notFound()

  return (
    <div className="p-8">
      <PageHeader
        title="Settings"
        description={`Manage ${ctx.org.name}`}
        info="Configure terms, roles, positions, and feature flags. Changes here affect all members of this group."
      />

      <AdminPanel settings={settings} isSuperUser={isSuperUser} changeRequests={changeRequests} />
    </div>
  )
}
