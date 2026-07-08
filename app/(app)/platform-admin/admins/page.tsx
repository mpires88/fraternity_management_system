import { Card, CardContent } from '@/components/ui/card'
import { listPlatformAdmins } from '@/dal/platform-admin'
import { createClient } from '@/lib/supabase/server'

export default async function AdminsPage() {
  const supabase = await createClient()
  const admins = await listPlatformAdmins(supabase)

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Platform Admins</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {admins.length} super users with full platform access
        </p>
      </div>

      <div className="space-y-3">
        {admins.map((admin) => (
          <Card key={admin.id}>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{admin.email}</p>
                  <p className="text-xs text-muted-foreground font-mono">{admin.id}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Added {new Date(admin.created_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
        {admins.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">No platform admins found</p>
        )}
      </div>
    </div>
  )
}
