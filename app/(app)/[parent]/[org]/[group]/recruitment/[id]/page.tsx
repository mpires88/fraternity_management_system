import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ProspectDetailView } from '@/components/recruitment/prospect-detail-view'
import { PageHeader } from '@/components/ui/page-header'
import { getGroupContext } from '@/dal/group-context'
import { resolveProspectPhotoUrlDal } from '@/dal/prospect-photos'
import { getProspectDetailDal, type ProspectDetail } from '@/dal/recruitment'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { canManageFromContext } from '@/lib/utils/resolve-permissions'

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ parent: string; org: string; group: string; id: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug, id } = await params
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')

  const canManage = canManageFromContext(ctx, 'rush')

  const prospect = await getProspectDetailDal(supabase, id)
  if (!prospect) redirect(`/${parentSlug}/${orgSlug}/${groupSlug}/recruitment`)

  // photo_path rides along on getProspectDetailDal's select('*'); resolve it to
  // a signed URL (private bucket). The `photo_path` field isn't on the hand-
  // written ProspectDetail type yet, so read it defensively.
  const photoPath = (prospect as ProspectDetail & { photo_path?: string | null }).photo_path ?? null
  const photoUrl = await resolveProspectPhotoUrlDal(supabase, photoPath)

  const basePath = `/${parentSlug}/${orgSlug}/${groupSlug}`

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`${basePath}/recruitment`} className="hover:underline">
          Recruitment
        </Link>
        <span>/</span>
        <span className="text-foreground">{prospect.full_name}</span>
      </div>

      <PageHeader
        title={prospect.full_name}
        description={`Added by ${prospect.added_by_name} · ${new Date(prospect.created_at).toLocaleDateString()}`}
        info="Everything the chapter knows about this prospect: event check-ins, brother feedback, and bid-vote status. Feedback is wiped automatically if a bid is accepted."
      />

      <ProspectDetailView
        prospect={prospect}
        canManage={canManage}
        personId={ctx.person.id}
        photoUrl={photoUrl}
      />
    </div>
  )
}
