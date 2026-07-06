'use client'

import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  deleteStatusDefinition,
  upsertStatusDefinition,
} from '@/actions/admin/update-settings.action'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminSettingsData } from '@/dal/admin'

type StatusDef = AdminSettingsData['statusDefinitions'][0]

export function StatusDefinitionsTab({
  settings,
  parentSlug,
  orgSlug,
}: {
  settings: AdminSettingsData
  parentSlug: string
  orgSlug: string
}) {
  const [editing, setEditing] = useState<StatusDef | 'new' | null>(null)

  const baseStatuses = settings.statusDefinitions.filter((s) => s.is_base)
  const extendedStatuses = settings.statusDefinitions.filter((s) => !s.is_base)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Status Definitions</CardTitle>
            <CardDescription>
              Status overrides role permissions. Base statuses cannot be modified.
            </CardDescription>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-hover text-brand-foreground text-sm rounded-lg font-medium transition-colors"
          >
            <Plus size={14} /> Add Extended
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {baseStatuses.length > 0 && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Base (platform)
            </p>
            <div className="divide-y divide-border/50 mb-6">
              {baseStatuses.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: s.color ?? 'var(--muted-foreground)' }}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{overrideSummary(s)}</p>
                    </div>
                  </div>
                  <Lock size={13} className="text-muted-foreground" />
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Extended (org-defined)
        </p>
        {extendedStatuses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No extended statuses defined.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {extendedStatuses.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: s.color ?? 'var(--muted-foreground)' }}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{overrideSummary(s)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditing(s)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  <Pencil size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <StatusForm
            existing={editing === 'new' ? null : editing}
            groupId={settings.org.id}
            parentSlug={parentSlug}
            orgSlug={orgSlug}
            nextOrder={(settings.statusDefinitions.length + 1) * 10}
            onClose={() => setEditing(null)}
          />
        )}
      </CardContent>
    </Card>
  )
}

function overrideSummary(s: StatusDef): string {
  const overrides: string[] = []
  if (s.override_access_level) overrides.push(`access→${s.override_access_level}`)
  if (s.override_can_vote === false) overrides.push('no vote')
  if (s.override_can_hold_office === false) overrides.push('no office')
  if (s.override_can_attend_events === false) overrides.push('no events')
  return overrides.length ? overrides.join(', ') : 'no overrides (role applies as-is)'
}

function StatusForm({
  existing,
  groupId,
  parentSlug,
  orgSlug,
  nextOrder,
  onClose,
}: {
  existing: StatusDef | null
  groupId: string
  parentSlug: string
  orgSlug: string
  nextOrder: number
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState(existing?.color ?? '#6b7280')
  const [overrideAccess, setOverrideAccess] = useState(existing?.override_access_level ?? '')
  const [overrideVote, setOverrideVote] = useState<boolean | null>(
    existing?.override_can_vote ?? null
  )
  const [overrideOffice, setOverrideOffice] = useState<boolean | null>(
    existing?.override_can_hold_office ?? null
  )
  const [overrideEvents, setOverrideEvents] = useState<boolean | null>(
    existing?.override_can_attend_events ?? null
  )

  function handleSave() {
    setError('')
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    startTransition(async () => {
      const result = await upsertStatusDefinition({
        id: existing?.id,
        groupId,
        name,
        slug: existing?.slug ?? slug,
        color,
        display_order: existing?.display_order ?? nextOrder,
        override_access_level: overrideAccess || null,
        override_can_vote: overrideVote,
        override_can_hold_office: overrideOffice,
        override_can_attend_events: overrideEvents,
        parentSlug,
        orgSlug,
      })
      if (!result.success) {
        setError(result.error ?? 'Failed')
        return
      }
      router.refresh()
      onClose()
    })
  }

  function handleDelete() {
    if (!existing) return
    startTransition(async () => {
      const result = await deleteStatusDefinition({ id: existing.id, parentSlug, orgSlug })
      if (!result.success) {
        setError(result.error ?? 'Failed')
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-4">
      <h4 className="text-sm font-semibold text-foreground">
        {existing ? 'Edit' : 'New'} Extended Status
      </h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-20 rounded border border-input cursor-pointer"
          />
        </div>
      </div>

      <p className="text-xs font-medium text-muted-foreground">
        Overrides (null = no change from role)
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Access level</label>
          <select
            value={overrideAccess}
            onChange={(e) => setOverrideAccess(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">No override</option>
            <option value="full">Full</option>
            <option value="limited">Limited</option>
            <option value="read_only">Read only</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <TriStateToggle label="Vote" value={overrideVote} onChange={setOverrideVote} />
        <TriStateToggle label="Hold office" value={overrideOffice} onChange={setOverrideOffice} />
        <TriStateToggle label="Attend events" value={overrideEvents} onChange={setOverrideEvents} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between">
        <div>
          {existing && (
            <button
              onClick={handleDelete}
              className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground text-sm rounded-lg font-medium transition-colors"
          >
            {isPending ? 'Saving\u2026' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TriStateToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean | null) => void
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <select
        value={value === null ? 'null' : value ? 'true' : 'false'}
        onChange={(e) => onChange(e.target.value === 'null' ? null : e.target.value === 'true')}
        className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <option value="null">No override</option>
        <option value="false">Force off</option>
        <option value="true">Force on</option>
      </select>
    </div>
  )
}
