import { Card, CardContent } from '@/components/ui/card'
import { getPlatformStats, listParentOrgs } from '@/dal/platform-admin'
import { createClient } from '@/lib/supabase/server'

export default async function PlatformAdminPage() {
  const supabase = await createClient()
  const [stats, recentOrgs] = await Promise.all([
    getPlatformStats(supabase),
    listParentOrgs(supabase),
  ])

  const statCards = [
    { label: 'National Orgs', value: stats.parentOrgs },
    { label: 'Chapters', value: stats.organizations },
    { label: 'Groups', value: stats.groups },
    { label: 'Users', value: stats.persons },
  ]

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide statistics and status</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-0">
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Recent National Organizations
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recentOrgs.slice(0, 6).map((org) => (
            <Card key={org.id}>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 shrink-0">
                    {org.primary_color ? (
                      <div
                        className="w-3 h-3 rounded-full border border-border"
                        style={{ backgroundColor: org.primary_color }}
                      />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-muted border border-border" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{org.name}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {org.abbreviation && `${org.abbreviation} · `}
                  {org.org_type}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
