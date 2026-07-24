import { redirect } from 'next/navigation'
import { RecruitmentBoard } from '@/components/recruitment/recruitment-board'
import { PageHeader } from '@/components/ui/page-header'
import { getEventsForGroupDal } from '@/dal/events'
import { getGroupContext } from '@/dal/group-context'
import { resolveProspectPhotoUrlsDal } from '@/dal/prospect-photos'
import {
  type ConversionLookups,
  getActiveTermDal,
  getConversionLookupsDal,
  getProspectsForTermDal,
  readRecruitmentCalendarHours,
} from '@/dal/recruitment'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import {
  canManageFromContext,
  resolvePermissionsFromContext,
} from '@/lib/utils/resolve-permissions'

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
  // Editing the calendar window writes to groups.settings — RLS-gated to org
  // admins, so only surface the control to full-access admins.
  const canEditCalendar = resolvePermissionsFromContext(ctx).access_level === 'full'
  const calendarHours = readRecruitmentCalendarHours(ctx.group.settings)
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

  // Batch-resolve headshot signed URLs (private bucket), keyed by prospect id
  const urlByPath = await resolveProspectPhotoUrlsDal(
    supabase,
    prospects.map((p) => p.photo_path)
  )
  const photoUrls: Record<string, string> = {}
  for (const p of prospects) {
    if (p.photo_path && urlByPath[p.photo_path]) photoUrls[p.id] = urlByPath[p.photo_path]
  }

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        title={label}
        description={`${activeTerm.name} — ${prospects.length} prospects`}
        info="Track prospects from first meeting to bid: any member can add a prospect, leave feedback, and check prospects in at events; recruitment managers move them through the pipeline, run secret bid votes, and convert accepted bids into members."
      />
      <RecruitmentBoard
        prospects={prospects}
        events={events}
        termId={activeTerm.id}
        canManage={canManage}
        canEditCalendar={canEditCalendar}
        calendarHours={calendarHours}
        basePath={basePath}
        photoUrls={photoUrls}
        roleTypes={lookups.roleTypes}
        candidateSubgroups={lookups.candidateSubgroups}
        statuses={lookups.statuses}
      />
    </div>
  )
}
