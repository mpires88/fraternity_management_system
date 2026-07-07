import { redirect } from 'next/navigation'
import { DocumentsView } from '@/components/documents/documents-view'
import { getDocumentsForGroup } from '@/dal/documents'
import { getGroupContext } from '@/dal/group-context'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissionsFromContext } from '@/lib/utils/resolve-permissions'

export default async function DocumentsPage({
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
  const isAdmin = perms.access_level === 'full'

  const documents = await getDocumentsForGroup(supabase, ctx.group.id)

  return (
    <div className="p-8">
      <DocumentsView documents={documents} isAdmin={isAdmin} />
    </div>
  )
}
