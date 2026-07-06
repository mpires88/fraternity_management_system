import { ArrowRight, Users } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function OrgLandingPage({
  params,
}: {
  params: Promise<{ parent: string; org: string }>
}) {
  const { parent: parentSlug, org: orgSlug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Look up the organization
  const { data: parentOrg } = await supabase
    .from('parent_organizations')
    .select('id, name, slug')
    .eq('slug', parentSlug)
    .single()

  let orgId: string | null = null
  let orgName = ''

  if (parentOrg) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('parent_organization_id', parentOrg.id)
      .eq('slug', orgSlug)
      .single()
    if (org) {
      orgId = org.id
      orgName = org.name
    }
  }

  if (!orgId) redirect('/login')

  // Get all groups in this org that the user belongs to
  const { data: memberGroups } = await supabase
    .from('group_memberships')
    .select('group_id, role_types(name), status_definitions(name, slug)')
    .eq('person_id', user.id)
    .is('ended_at', null)

  const activeGroupIds = (memberGroups ?? [])
    .filter((m) => (m.status_definitions as { slug: string })?.slug !== 'expelled')
    .map((m) => m.group_id)

  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, slug, group_type, is_primary')
    .eq('organization_id', orgId)
    .in('id', activeGroupIds.length > 0 ? activeGroupIds : ['none'])
    .order('is_primary', { ascending: false })

  // If only one group, go straight there
  if (groups && groups.length === 1) {
    redirect(`/${parentSlug}/${orgSlug}/${groups[0].slug}/dashboard`)
  }

  // Get member counts per group
  const { data: allMembers } = await supabase
    .from('group_memberships')
    .select('group_id, status_definitions(slug)')
    .in(
      'group_id',
      (groups ?? []).map((g) => g.id)
    )
    .is('ended_at', null)

  const counts: Record<string, number> = {}
  for (const m of allMembers ?? []) {
    const slug = (m.status_definitions as { slug: string })?.slug
    if (slug !== 'expelled') {
      counts[m.group_id] = (counts[m.group_id] ?? 0) + 1
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-8 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground">{orgName}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {parentOrg?.name ? `${parentOrg.name} · ` : ''}Select a group to continue.
          </p>
        </div>

        <div className="space-y-3">
          {(groups ?? []).map((g) => {
            const membership = memberGroups?.find((m) => m.group_id === g.id)
            const roleName = (membership?.role_types as { name: string })?.name ?? 'Member'
            const statusName =
              (membership?.status_definitions as { name: string })?.name ?? 'Active'

            return (
              <Link key={g.id} href={`/${parentSlug}/${orgSlug}/${g.slug}/dashboard`}>
                <Card className="hover:ring-brand/30 transition-all cursor-pointer group/card">
                  <CardContent className="flex items-center justify-between pt-0">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center text-brand font-bold shrink-0">
                        {g.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground group-hover/card:text-brand transition-colors">
                          {g.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {g.group_type && (
                            <span className="text-xs text-muted-foreground capitalize">
                              {g.group_type.replace('_', ' ')}
                            </span>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {roleName}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {statusName}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users size={12} />
                        {counts[g.id] ?? 0}
                      </div>
                      <ArrowRight
                        size={16}
                        className="text-muted-foreground group-hover/card:text-brand transition-colors"
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {(!groups || groups.length === 0) && (
          <Card className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              You don&apos;t belong to any groups in this organization.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
