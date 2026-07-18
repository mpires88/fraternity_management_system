import { ChevronRight, GitBranch, Home, Shield, UserPlus, Users } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CreateSubgroupButton } from '@/components/subgroups/create-subgroup-dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { getGroupContext } from '@/dal/group-context'
import { getSubgroupsByOrg } from '@/dal/subgroups'
import { getLabel, SUBGROUP_TYPE_LABELS } from '@/lib/constants/labels'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { resolvePermissionsFromContext } from '@/lib/utils/resolve-permissions'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  committee: <Users size={15} />,
  exec_board: <Shield size={15} />,
  pledge_class: <UserPlus size={15} />,
  house_residents: <Home size={15} />,
  family_line: <GitBranch size={15} />,
  ad_hoc: <Users size={15} />,
}

export default async function SubgroupsPage({
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
  const perms = resolvePermissionsFromContext(ctx)

  const subgroups = await getSubgroupsByOrg(supabase, ctx.group.id)
  const base = `/${parentSlug}/${orgSlug}/${groupSlug}`

  // Group by type
  const grouped = new Map<string, typeof subgroups>()
  for (const sg of subgroups) {
    const type = sg.subgroup_type ?? 'other'
    if (!grouped.has(type)) grouped.set(type, [])
    grouped.get(type)!.push(sg)
  }

  // Order types
  const typeOrder = [
    'exec_board',
    'committee',
    'family_line',
    'pledge_class',
    'house_residents',
    'ad_hoc',
    'other',
  ]
  const sortedTypes = [...grouped.keys()].sort(
    (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
  )

  return (
    <div className="p-8">
      <PageHeader
        title="Subgroups"
        description={`${subgroups.length} group${subgroups.length !== 1 ? 's' : ''}`}
        info="Subgroups organize members into committees, exec boards, pledge classes, family lines, and more. Click a subgroup to see its members."
      >
        {perms.access_level === 'full' && <CreateSubgroupButton />}
      </PageHeader>

      {subgroups.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-sm text-muted-foreground">No subgroups yet.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {sortedTypes.map((type) => {
            const items = grouped.get(type)!
            return (
              <div key={type}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {getLabel(SUBGROUP_TYPE_LABELS, type)} ({items.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((sg) => (
                    <Link key={sg.id} href={`${base}/subgroups/${sg.slug}`}>
                      <Card className="hover:ring-brand/30 transition-all cursor-pointer group h-full">
                        <CardContent className="pt-0">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-muted-foreground shrink-0">
                                {TYPE_ICONS[sg.subgroup_type ?? 'ad_hoc'] ?? <Users size={15} />}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground group-hover:text-brand transition-colors truncate">
                                  {sg.name}
                                </p>
                                {sg.head && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    Head: {sg.head.full_name}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <Badge variant="secondary" className="text-xs">
                                {sg.member_count}
                              </Badge>
                              <ChevronRight size={14} className="text-muted-foreground" />
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            {sg.is_locked && (
                              <Badge variant="outline" className="text-xs">
                                Locked
                              </Badge>
                            )}
                            {sg.is_private && (
                              <Badge variant="outline" className="text-xs">
                                Private
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
