import { redirect } from 'next/navigation'
import { DocumentDetail } from '@/components/documents/document-detail'
import { getCommentsForResource, getDocumentById } from '@/dal/documents'
import { getGroupContext } from '@/dal/group-context'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissionsFromContext } from '@/lib/utils/resolve-permissions'

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ parent: string; org: string; group: string; documentId: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug, documentId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')
  const perms = resolvePermissionsFromContext(ctx)
  const isAdmin = perms.access_level === 'full'

  const doc = await getDocumentById(supabase, documentId)
  if (!doc) redirect('..')

  const comments = await getCommentsForResource(supabase, 'document', documentId)

  return (
    <div className="p-8">
      <DocumentDetail
        document={doc}
        comments={comments}
        isAdmin={isAdmin}
        personId={ctx.person.id}
      />
    </div>
  )
}
