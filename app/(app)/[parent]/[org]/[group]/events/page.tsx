import { redirect } from 'next/navigation'
import { ModulePreview } from '@/components/shared/module-preview'
import { getGroupContext } from '@/dal/group-context'
import { createClient, getAuthUser } from '@/lib/supabase/server'

export default async function EventsPage({
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
      title="Events"
      description="The group calendar — recruitment events first, meetings and socials later"
      phase="Phase 10"
      items={[
        {
          label: 'Event schedule',
          detail: 'Title, time, place, and kind — one generic calendar for every module.',
        },
        {
          label: 'Recruitment check-in',
          detail: 'Prospect attendance recorded per event from a phone.',
        },
        {
          label: 'Categories',
          detail: 'Group-defined event categories for filtering and color.',
        },
      ]}
    />
  )
}
