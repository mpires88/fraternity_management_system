import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { RequirementDetailView } from '@/components/requirements/requirement-detail'
import { getGroupContext } from '@/dal/group-context'
import { getRequirementById, getRequirementDetail } from '@/dal/requirements'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissionsFromContext } from '@/lib/utils/resolve-permissions'

export default async function RequirementDetailPage({
  params,
}: {
  params: Promise<{ parent: string; org: string; group: string; id: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug, id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')
  const perms = resolvePermissionsFromContext(ctx)

  if (perms.access_level !== 'full') {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">You don&apos;t have permission to view this page.</p>
      </div>
    )
  }

  const requirement = await getRequirementById(supabase, id)
  if (!requirement) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Requirement not found.</p>
      </div>
    )
  }

  const assignees = await getRequirementDetail(supabase, id)
  const base = `/${parentSlug}/${orgSlug}/${groupSlug}`

  return (
    <div className="p-8">
      <Link
        href={`${base}/requirements`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={14} />
        Back to Requirements
      </Link>

      <RequirementDetailView requirement={requirement} assignees={assignees} />
    </div>
  )
}
