import { redirect } from 'next/navigation'
import { InviteMemberButton } from '@/components/members/invite-member-dialog'
import { MembersTable } from '@/components/members/members-table'
import { getGroupContext } from '@/dal/group-context'
import { getMembersByOrg } from '@/dal/members'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissionsFromContext } from '@/lib/utils/resolve-permissions'

export default async function MembersPage({
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

  if (!perms.can_view_roster) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">
          You don&apos;t have permission to view the member roster.
        </p>
      </div>
    )
  }

  const members = await getMembersByOrg(supabase, ctx.org.id)

  const { data: roleTypes } = await supabase
    .from('role_types')
    .select('id, name, slug, is_default')
    .eq('group_id', ctx.org.id)
    .order('display_order')

  const canInvite = perms.access_level === 'full'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Members</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canInvite && (
          <InviteMemberButton
            membershipTypes={
              (roleTypes ?? []) as {
                id: string
                name: string
                slug: string
                is_default: boolean | null
              }[]
            }
          />
        )}
      </div>

      <MembersTable members={members} parentSlug={parentSlug} orgSlug={orgSlug} />
    </div>
  )
}
