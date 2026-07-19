import { redirect } from 'next/navigation'
import { ModulePreview } from '@/components/shared/module-preview'
import { getGroupContext } from '@/dal/group-context'
import { createClient, getAuthUser } from '@/lib/supabase/server'

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

  const label = (ctx.group.terminology as Record<string, string>)?.recruitment ?? 'Recruitment'

  return (
    <ModulePreview
      title={label}
      description="Prospect pipeline from first handshake to claimed account"
      phase="Phase 10"
      items={[
        {
          label: 'Prospect board',
          detail: 'Pipeline by status: prospect → offered → accepted / declined / withdrawn.',
        },
        {
          label: 'Event check-ins & feedback',
          detail:
            'Who came to what, and brother impressions — purged automatically when a bid is accepted.',
        },
        {
          label: 'Secret bid ballots',
          detail: 'One vote per prospect through the existing polls engine.',
        },
        {
          label: 'One-click conversion',
          detail: 'Accepted bid → member record, candidate-class subgroup, and a claim invite.',
        },
      ]}
    />
  )
}
