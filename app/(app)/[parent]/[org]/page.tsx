import { ArrowRight, Users } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getGroupPickerDataDal } from '@/dal/orgs'
import { createClient, getAuthUser } from '@/lib/supabase/server'

export default async function OrgLandingPage({
  params,
}: {
  params: Promise<{ parent: string; org: string }>
}) {
  const { parent: parentSlug, org: orgSlug } = await params
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const data = await getGroupPickerDataDal(supabase, user.id, parentSlug, orgSlug)
  if (!data) redirect('/login')

  const { parentOrgName, orgName, groups } = data

  // If only one group, go straight there
  if (groups.length === 1) {
    redirect(`/${parentSlug}/${orgSlug}/${groups[0].slug}/dashboard`)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-8 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground">{orgName}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {parentOrgName ? `${parentOrgName} · ` : ''}Select a group to continue.
          </p>
        </div>

        <div className="space-y-3">
          {groups.map((g) => (
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
                          {g.roleName}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {g.statusName}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users size={12} />
                      {g.memberCount}
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-muted-foreground group-hover/card:text-brand transition-colors"
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {groups.length === 0 && (
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
