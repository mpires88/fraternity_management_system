import { listOrganizations } from '@/dal/platform-admin'
import { createClient } from '@/lib/supabase/server'

export default async function ChaptersPage() {
  const supabase = await createClient()
  const orgs = await listOrganizations(supabase)

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Chapters</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {orgs.length} chapter organizations across all national orgs
        </p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Chapter</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                National Org
              </th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orgs.map((org) => (
              <tr key={org.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-foreground">{org.name}</p>
                  <p className="text-xs text-muted-foreground">{org.slug}</p>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {org.parent_organizations?.name ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{org.org_type}</td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  No chapters found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
