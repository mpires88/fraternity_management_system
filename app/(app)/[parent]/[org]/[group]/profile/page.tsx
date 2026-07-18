import { redirect } from 'next/navigation'
import { ProfilePage } from '@/components/profile/profile-page'
import { getMyChangeRequests } from '@/dal/change-requests'
import { getGroupContext } from '@/dal/group-context'
import { getPersonProfile } from '@/dal/person-profile'
import { createClient, getAuthUser } from '@/lib/supabase/server'

export default async function MyProfileRoute({
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

  const [profile, changeRequests] = await Promise.all([
    getPersonProfile(supabase, ctx.person.id, ctx.group.id),
    getMyChangeRequests(supabase, ctx.person.id),
  ])
  if (!profile) redirect('/login')

  return <ProfilePage profile={profile} groupId={ctx.group.id} changeRequests={changeRequests} />
}
