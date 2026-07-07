'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { updateOrgDetails } from '@/actions/admin/update-settings.action'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminSettingsData } from '@/dal/admin'

const ALL_FEATURES = [
  { key: 'members', label: 'Members', description: 'Member directory and roster' },
  { key: 'announcements', label: 'Announcements', description: 'Post updates to the chapter' },
  { key: 'documents', label: 'Documents', description: 'Document storage and sharing' },
  { key: 'meetings', label: 'Meetings', description: 'Meeting scheduling and minutes' },
  { key: 'events', label: 'Events', description: 'Event calendar and attendance' },
  { key: 'budget', label: 'Budget', description: 'Budget proposals and expense tracking' },
  { key: 'dues', label: 'Dues', description: 'Dues tracking and invoicing' },
  { key: 'elections', label: 'Elections', description: 'Officer elections and voting' },
  { key: 'voting', label: 'Voting', description: 'Standalone voting and polls' },
  { key: 'house', label: 'House', description: 'Rooms, chores, and house issues' },
  { key: 'rush', label: 'Rush', description: 'Prospect tracking and bid management' },
  { key: 'tasks', label: 'Tasks', description: 'Task assignment and tracking' },
  { key: 'subgroups', label: 'Subgroups', description: 'Committees and groups' },
]

export function FeatureFlagsTab({ settings }: { settings: AdminSettingsData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [features, setFeatures] = useState<Record<string, boolean>>(settings.org.features)
  const [saved, setSaved] = useState(false)

  function toggle(key: string) {
    setFeatures((f) => ({ ...f, [key]: !f[key] }))
    setSaved(false)
  }

  function handleSave() {
    setSaved(false)
    startTransition(async () => {
      const result = await updateOrgDetails({
        name: settings.org.name,
        features,
      })
      if (result.success) {
        setSaved(true)
        router.refresh()
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Flags</CardTitle>
        <CardDescription>Enable or disable features for this organization.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {ALL_FEATURES.map((f) => (
          <label
            key={f.key}
            className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-accent/50 -mx-4 px-4 rounded transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </div>
            <button
              onClick={() => toggle(f.key)}
              className={`relative w-9 h-5 rounded-full transition-colors ${features[f.key] ? 'bg-brand' : 'bg-input'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${features[f.key] ? 'translate-x-4' : ''}`}
              />
            </button>
          </label>
        ))}
        <div className="pt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground text-sm rounded-lg font-medium transition-colors"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-sm text-success">Saved</span>}
        </div>
      </CardContent>
    </Card>
  )
}
