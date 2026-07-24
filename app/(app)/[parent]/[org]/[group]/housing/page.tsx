import { redirect } from 'next/navigation'
import { OccupancyView } from '@/components/housing/occupancy-view'
import { PageHeader } from '@/components/ui/page-header'
import { getGroupContext } from '@/dal/group-context'
import { getAssignableMembersDal, getHousingTermsDal, getOccupancyDal } from '@/dal/housing'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { canManageFromContext } from '@/lib/utils/resolve-permissions'

export default async function HousingPage({
  params,
  searchParams,
}: {
  params: Promise<{ parent: string; org: string; group: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug } = await params
  const query = await searchParams
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')

  const canManage = canManageFromContext(ctx, 'houseManager')

  const allTerms = await getHousingTermsDal(supabase, ctx.group.id)
  const terms = allTerms.map((t) => ({ id: t.id, name: t.name }))
  const activeTerm = allTerms.find((t) => t.status === 'active')

  const requestedTermId = typeof query.term === 'string' ? query.term : null
  const selectedTermId =
    (requestedTermId && terms.some((t) => t.id === requestedTermId) ? requestedTermId : null) ??
    activeTerm?.id ??
    terms[0]?.id
  const selectedTerm = terms.find((t) => t.id === selectedTermId)

  let facilities: Awaited<ReturnType<typeof getOccupancyDal>> = []
  let members: Array<{ id: string; name: string }> = []

  if (selectedTermId) {
    facilities = await getOccupancyDal(supabase, ctx.org.id, selectedTermId)
    if (canManage) {
      members = await getAssignableMembersDal(supabase, ctx.group.id)
    }
  }

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        title="Housing"
        description={selectedTerm ? `${selectedTerm.name} occupancy` : 'No terms yet'}
        info="View room occupancy by facility and term. House managers can assign residents to rooms, end assignments, and swap two residents between rooms."
      />
      <OccupancyView
        facilities={facilities}
        canManage={canManage}
        members={members}
        terms={terms}
        selectedTermId={selectedTermId ?? null}
        activeTermId={activeTerm?.id ?? null}
      />
    </div>
  )
}
