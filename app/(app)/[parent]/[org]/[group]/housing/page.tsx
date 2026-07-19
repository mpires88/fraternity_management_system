import { redirect } from 'next/navigation'
import { ModulePreview } from '@/components/shared/module-preview'
import { getGroupContext } from '@/dal/group-context'
import { createClient, getAuthUser } from '@/lib/supabase/server'

export default async function HousingPage({
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
      title="Housing"
      description="Rooms, occupancy, and how they get assigned"
      phase="Phases 12 & 14"
      items={[
        {
          label: 'Rooms & occupancy',
          detail: 'The real room inventory with who lives where, term by term.',
        },
        {
          label: 'Direct assignment',
          detail: 'House manager assigns rooms any time — summer boarders, mid-year moves, swaps.',
        },
        {
          label: 'Points draft (optional)',
          detail:
            'Live room draft in points order — activity + seniority + adjustments, turn order enforced by the database.',
        },
        {
          label: 'Housing contracts',
          detail: 'Signed agreement + room & board tracked per resident.',
        },
      ]}
    />
  )
}
