'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { updateOrgDetails } from '@/actions/admin/update-settings.action'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminSettingsData } from '@/dal/admin'
import { getLabel, ORG_TYPE_LABELS } from '@/lib/constants/labels'

export function OrgDetailsTab({
  settings,
  parentSlug,
  orgSlug,
}: {
  settings: AdminSettingsData
  parentSlug: string
  orgSlug: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(settings.org.name)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await updateOrgDetails({
        groupId: settings.org.id,
        name,
        features: settings.org.features,
        parentSlug,
        orgSlug,
      })
      if (!result.success) {
        setError(result.error ?? 'Failed')
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
          <p className="text-sm text-foreground">
            {getLabel(ORG_TYPE_LABELS, settings.org.org_type)}
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Slug</label>
          <p className="text-sm text-muted-foreground font-mono">{settings.org.slug}</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-success">Saved</p>}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground text-sm rounded-lg font-medium transition-colors"
        >
          {isPending ? 'Saving\u2026' : 'Save'}
        </button>
      </CardContent>
    </Card>
  )
}
