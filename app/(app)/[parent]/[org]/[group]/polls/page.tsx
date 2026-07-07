import { redirect } from 'next/navigation'
import { PollsView } from '@/components/polls/polls-view'
import { getGroupContext } from '@/dal/group-context'
import { getPollsForGroup } from '@/dal/polls'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissionsFromContext } from '@/lib/utils/resolve-permissions'

export default async function PollsPage({
  params,
}: {
  params: Promise<{ parent: string; org: string; group: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')
  const perms = resolvePermissionsFromContext(ctx)
  const isAdmin = perms.access_level === 'full'

  const polls = await getPollsForGroup(supabase, ctx.group.id)

  let members: { id: string; full_name: string }[] = []
  if (isAdmin) {
    const { data } = await supabase
      .from('group_memberships')
      .select('person_id, persons!group_memberships_person_id_fkey(full_name)')
      .eq('group_id', ctx.group.id)

    members = (data ?? []).map((m) => ({
      id: m.person_id,
      full_name: (m.persons as unknown as { full_name: string })?.full_name ?? '',
    }))
  }

  return (
    <div className="p-8">
      <PollsView polls={polls} isAdmin={isAdmin} members={members} />
    </div>
  )
}
