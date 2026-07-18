import { notFound, redirect } from 'next/navigation'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SetOrgCookie } from '@/components/layout/set-org-cookie'
import { BrandColorProvider } from '@/components/providers/brand-color-provider'
import { getGroupContext } from '@/dal/group-context'
import { OrgProvider } from '@/lib/context/org-context'
import { createClient, getAuthUser } from '@/lib/supabase/server'

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ parent: string; org: string; group: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug } = await params
  const supabase = await createClient()

  const user = await getAuthUser()
  if (!user) redirect('/login')

  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)

  if (!ctx || ctx.roles.length === 0) notFound()

  return (
    <OrgProvider value={ctx}>
      <BrandColorProvider>
        <SetOrgCookie groupId={ctx.group.id} />
        <div className="flex h-screen overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-y-auto bg-background">{children}</main>
        </div>
      </BrandColorProvider>
    </OrgProvider>
  )
}
