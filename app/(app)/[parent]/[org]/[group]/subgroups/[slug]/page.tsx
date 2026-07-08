import { ArrowLeft, Crown, Users } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { MemberAvatar } from '@/components/shared/member-avatar'
import {
  AddSubgroupMemberButton,
  RemoveSubgroupMemberButton,
} from '@/components/subgroups/subgroup-member-manager'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getGroupContext } from '@/dal/group-context'
import { getMembersByOrg } from '@/dal/members'
import { getSubgroupBySlug } from '@/dal/subgroups'
import { getLabel, SUBGROUP_TYPE_LABELS } from '@/lib/constants/labels'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissionsFromContext } from '@/lib/utils/resolve-permissions'

export default async function SubgroupDetailPage({
  params,
}: {
  params: Promise<{ parent: string; org: string; group: string; slug: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug, slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')

  const subgroup = await getSubgroupBySlug(supabase, ctx.group.id, slug)
  if (!subgroup) notFound()

  const base = `/${parentSlug}/${orgSlug}/${groupSlug}`
  const perms = resolvePermissionsFromContext(ctx)
  const canManage = perms.access_level === 'full'

  const roster = canManage ? await getMembersByOrg(supabase, ctx.group.id) : []
  const rosterForPicker = roster.map((m) => ({
    person_id: m.person.id,
    full_name: m.person.full_name,
  }))
  const existingMemberIds = subgroup.members.map((m) => m.person_id)

  const headMembers = subgroup.members.filter((m) => m.role === 'head')
  const regularMembers = subgroup.members.filter((m) => m.role !== 'head')

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href={`${base}/subgroups`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Subgroups
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-foreground">{subgroup.name}</h1>
          <Badge variant="secondary" className="text-xs">
            {getLabel(SUBGROUP_TYPE_LABELS, subgroup.subgroup_type)}
          </Badge>
          {subgroup.is_locked && (
            <Badge variant="outline" className="text-xs">
              Locked
            </Badge>
          )}
          {subgroup.is_private && (
            <Badge variant="outline" className="text-xs">
              Private
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {subgroup.member_count} member{subgroup.member_count !== 1 ? 's' : ''}
          {subgroup.head_position_title && ` · Head: ${subgroup.head_position_title}`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Member list */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users size={16} />
                  Members
                </CardTitle>
                {canManage && (
                  <AddSubgroupMemberButton
                    subgroupId={subgroup.id}
                    roster={rosterForPicker}
                    existingMemberIds={existingMemberIds}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {subgroup.members.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No members yet.</p>
              ) : (
                <div className="divide-y divide-border/50 -mt-2">
                  {headMembers.map((m) => (
                    <MemberRow key={m.id} member={m} base={base} isHead canManage={canManage} />
                  ))}
                  {regularMembers.map((m) => (
                    <MemberRow key={m.id} member={m} base={base} canManage={canManage} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Type</dt>
                  <dd className="text-foreground">
                    {getLabel(SUBGROUP_TYPE_LABELS, subgroup.subgroup_type)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Membership</dt>
                  <dd className="text-foreground capitalize">
                    {subgroup.membership_type?.replace('_', ' ') ?? 'Manual'}
                  </dd>
                </div>
                {subgroup.head_position_title && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Head position</dt>
                    <dd className="text-foreground">{subgroup.head_position_title}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground text-xs">Members</dt>
                  <dd className="text-foreground">{subgroup.member_count}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {subgroup.head && (
            <Card>
              <CardHeader>
                <CardTitle>Head</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`${base}/members/${subgroup.head.person_id}`}
                  className="flex items-center gap-3 hover:bg-accent -mx-1 px-1 py-1 rounded transition-colors"
                >
                  <MemberAvatar fullName={subgroup.head.full_name} size="md" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{subgroup.head.full_name}</p>
                    {subgroup.head_position_title && (
                      <p className="text-xs text-muted-foreground">
                        {subgroup.head_position_title}
                      </p>
                    )}
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function MemberRow({
  member,
  base,
  isHead = false,
  canManage = false,
}: {
  member: {
    id: string
    person_id: string
    full_name: string
    nickname: string | null
    profile_photo: string | null
    role: string
    join_type: string | null
  }
  base: string
  isHead?: boolean
  canManage?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2.5 -mx-4 px-4 rounded transition-colors group">
      <Link
        href={`${base}/members/${member.person_id}`}
        className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
      >
        <MemberAvatar src={member.profile_photo} fullName={member.full_name} size="sm" />
        <div>
          <p className="text-sm font-medium text-foreground group-hover:text-brand transition-colors">
            {member.full_name}
          </p>
          {member.nickname && (
            <p className="text-xs text-muted-foreground">&ldquo;{member.nickname}&rdquo;</p>
          )}
        </div>
      </Link>
      <div className="flex items-center gap-2">
        {isHead && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Crown size={10} />
            Head
          </Badge>
        )}
        {member.join_type && (
          <Badge variant="outline" className="text-xs capitalize">
            {member.join_type.replace('_', ' ')}
          </Badge>
        )}
        {canManage && (
          <RemoveSubgroupMemberButton
            member={{ id: member.id, person_id: member.person_id, full_name: member.full_name }}
          />
        )}
      </div>
    </div>
  )
}
