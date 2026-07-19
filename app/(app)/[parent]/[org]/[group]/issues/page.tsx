import { redirect } from 'next/navigation'
import { ModulePreview } from '@/components/shared/module-preview'
import { getGroupContext } from '@/dal/group-context'
import { createClient, getAuthUser } from '@/lib/supabase/server'

export default async function IssuesPage({
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

  return (
    <ModulePreview
      title="Issues"
      description="Report a problem, watch it get fixed"
      phase="Phase 13"
      items={[
        {
          label: 'Report anything',
          detail:
            'Maintenance, safety, equipment, or operations — with photos, room, and priority.',
        },
        {
          label: 'Triage & assignment',
          detail: 'House manager or officers acknowledge, assign an owner, and track progress.',
        },
        {
          label: 'Escalation',
          detail: 'Money-and-contractor items move into the housing corporation’s queue.',
        },
      ]}
    />
  )
}
