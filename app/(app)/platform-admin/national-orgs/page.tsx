import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { listParentOrgs } from '@/dal/platform-admin'
import { createClient } from '@/lib/supabase/server'

export default async function NationalOrgsPage() {
  const supabase = await createClient()
  const orgs = await listParentOrgs(supabase)

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">National Organizations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {orgs.length} organizations — manage branding, colors, and details
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {orgs.map((org) => (
          <Link key={org.id} href={`/platform-admin/national-orgs/${org.id}`}>
            <Card className="hover:ring-brand/30 transition-all cursor-pointer group h-full">
              <CardContent className="pt-0">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 shrink-0">
                    {org.primary_color && (
                      <div
                        className="w-4 h-4 rounded-full border border-border"
                        style={{ backgroundColor: org.primary_color }}
                      />
                    )}
                    {org.secondary_color && (
                      <div
                        className="w-4 h-4 rounded-full border border-border"
                        style={{ backgroundColor: org.secondary_color }}
                      />
                    )}
                    {!org.primary_color && !org.secondary_color && (
                      <div className="w-4 h-4 rounded-full bg-muted border border-border" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-brand transition-colors truncate">
                      {org.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {org.abbreviation && `${org.abbreviation} · `}
                      {org.org_type ?? 'organization'}
                      {org.founded_year && ` · ${org.founded_year}`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
