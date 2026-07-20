import { redirect } from 'next/navigation'
import { RecruitmentBoard } from '@/components/recruitment/recruitment-board'
import { PageHeader } from '@/components/ui/page-header'
import { getEventsForGroupDal } from '@/dal/events'
import { getGroupContext } from '@/dal/group-context'
import {
  type ConversionLookups,
  getActiveTermDal,
  getConversionLookupsDal,
  getProspectsForTermDal,
} from '@/dal/recruitment'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { canManageFromContext } from '@/lib/utils/resolve-permissions'

export default async function RecruitmentPage({
  params,
}: {
  params: Promise<{ parent: string; org: string; group: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug } = await params
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')

  const canManage = canManageFromContext(ctx, 'rush')
  const label = (ctx.group.terminology as Record<string, string>)?.recruitment ?? 'Recruitment'

  const activeTerm = await getActiveTermDal(supabase, ctx.group.id)

  if (!activeTerm) {
    return (
      <div className="p-8">
        <PageHeader
          title={label}
          description="No active term. An officer needs to create and activate a term first."
          info="Prospects are tracked per term, so this page needs an active term before anyone can be added."
        />
      </div>
    )
  }

  // The role/status/candidate-class lookups only feed the convert dialog —
  // skip them entirely for members who can't manage
  const emptyLookups: ConversionLookups = { roleTypes: [], candidateSubgroups: [], statuses: [] }
  const [prospects, events, lookups] = await Promise.all([
    getProspectsForTermDal(supabase, ctx.group.id, activeTerm.id),
    getEventsForGroupDal(supabase, ctx.group.id, 'recruitment', activeTerm.id),
    canManage ? getConversionLookupsDal(supabase, ctx.group.id) : Promise.resolve(emptyLookups),
  ])

  const basePath = `/${parentSlug}/${orgSlug}/${groupSlug}`

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        title={label}
        description={`${activeTerm.name} — ${prospects.length} prospects`}
        info="Track prospects from first meeting to bid: anyone can add feedback and check prospects in at events; recruitment managers move them through the pipeline, run secret bid votes, and convert accepted bids into members."
      />
      <RecruitmentBoard
        prospects={prospects}
        events={events}
        termId={activeTerm.id}
        canManage={canManage}
        basePath={basePath}
        roleTypes={lookups.roleTypes}
        candidateSubgroups={lookups.candidateSubgroups}
        statuses={lookups.statuses}
      />
    </div>
  )
}
