'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminSettingsData } from '@/dal/admin'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function TermDefinitionsTab({
  settings,
}: {
  settings: AdminSettingsData
  parentSlug: string
  orgSlug: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Term Definitions</CardTitle>
        <CardDescription>
          Defines your academic calendar structure. Editing coming soon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {settings.termDefinitions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No terms defined.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {settings.termDefinitions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {MONTHS[t.start_month - 1]} {t.start_day} — {MONTHS[t.end_month - 1]}{' '}
                    {t.end_day}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {t.has_elections && (
                    <Badge variant="outline" className="text-[10px]">
                      Elections
                    </Badge>
                  )}
                  {t.has_budget && (
                    <Badge variant="outline" className="text-[10px]">
                      Budget
                    </Badge>
                  )}
                  {t.has_rush && (
                    <Badge variant="outline" className="text-[10px]">
                      Rush
                    </Badge>
                  )}
                  {!t.is_active && (
                    <Badge variant="secondary" className="text-[10px]">
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
