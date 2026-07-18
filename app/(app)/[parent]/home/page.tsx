import { ArrowRight, Users } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getHomeData } from '@/dal/home'
import { getLabel, ORG_TYPE_LABELS } from '@/lib/constants/labels'
import { createClient, getAuthUser } from '@/lib/supabase/server'

export default async function HomePage({ params }: { params: Promise<{ parent: string }> }) {
  const { parent: parentSlug } = await params
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  // Look up the parent org
  const { data: parentOrg } = await supabase
    .from('parent_organizations')
    .select('id, name, slug')
    .eq('slug', parentSlug)
    .single()

  if (!parentOrg) redirect('/login')

  const allOrgs = await getHomeData(supabase, user.id)

  // Filter to orgs under this parent
  const orgs = allOrgs.filter((o) => o.parent_slug === parentSlug)

  if (orgs.length === 1) {
    redirect(`/${parentSlug}/${orgs[0].org_slug}/dashboard`)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-8 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground">{parentOrg.name}</h1>
          <p className="text-sm text-muted-foreground mt-2">Select an organization to continue.</p>
        </div>

        <div className="space-y-3">
          {orgs.map((o) => (
            <Link key={o.group_id} href={`/${parentSlug}/${o.org_slug}/dashboard`}>
              <Card className="hover:ring-brand/30 transition-all cursor-pointer group">
                <CardContent className="flex items-center justify-between pt-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center text-brand font-bold shrink-0">
                      {o.org_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{o.org_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {getLabel(ORG_TYPE_LABELS, o.org_type)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {o.role_name}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {o.status_name}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users size={12} />
                      {o.active_member_count}
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-muted-foreground group-hover:text-brand transition-colors"
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {orgs.length === 0 && (
          <Card className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              You don&apos;t belong to any organizations yet.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
