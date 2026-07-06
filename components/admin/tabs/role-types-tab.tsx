'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { deleteRoleType, upsertRoleType } from '@/actions/admin/update-settings.action'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminSettingsData } from '@/dal/admin'

type AffType = AdminSettingsData['roleTypes'][0]

const ACCESS_LEVELS = ['full', 'limited', 'read_only', 'none']
const PERMISSION_FIELDS = [
  { key: 'can_vote', label: 'Vote', description: 'Participate in elections and chapter votes' },
  {
    key: 'can_hold_office',
    label: 'Hold office',
    description: 'Be elected or appointed to officer positions',
  },
  {
    key: 'can_attend_events',
    label: 'Attend events',
    description: 'RSVP and attend chapter events',
  },
  {
    key: 'can_view_roster',
    label: 'View roster',
    description: 'See the member directory and profiles',
  },
  {
    key: 'can_view_financials',
    label: 'View financials',
    description: 'Access budgets, expenses, and financial reports',
  },
  {
    key: 'can_submit_expenses',
    label: 'Submit expenses',
    description: 'Submit expense requests for reimbursement',
  },
  {
    key: 'can_view_minutes',
    label: 'View minutes',
    description: 'Read meeting minutes after they are published',
  },
  {
    key: 'can_speak_at_meetings',
    label: 'Speak at meetings',
    description: 'Speak during chapter meetings and discussions',
  },
  {
    key: 'can_view_documents',
    label: 'View documents',
    description: 'Access shared documents and files',
  },
] as const

export function RoleTypesTab({
  settings,
  parentSlug,
  orgSlug,
}: {
  settings: AdminSettingsData
  parentSlug: string
  orgSlug: string
}) {
  const [editing, setEditing] = useState<AffType | 'new' | null>(null)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Role Types</CardTitle>
            <CardDescription>Define how people relate to this organization.</CardDescription>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-hover text-brand-foreground text-sm rounded-lg font-medium transition-colors"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50">
          {settings.roleTypes.map((at) => (
            <div key={at.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: at.color ?? 'var(--brand)' }}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{at.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {at.access_level} ·{' '}
                    {[
                      at.can_vote && 'vote',
                      at.can_hold_office && 'office',
                      at.can_view_financials && 'financials',
                    ]
                      .filter(Boolean)
                      .join(', ') || 'no special perms'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {at.is_default && (
                  <Badge variant="outline" className="text-xs mr-2">
                    Default
                  </Badge>
                )}
                <button
                  onClick={() => setEditing(at)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  <Pencil size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {editing && (
          <RoleForm
            existing={editing === 'new' ? null : editing}
            groupId={settings.org.id}
            parentSlug={parentSlug}
            orgSlug={orgSlug}
            nextOrder={(settings.roleTypes.length + 1) * 10}
            onClose={() => setEditing(null)}
          />
        )}
      </CardContent>
    </Card>
  )
}

function RoleForm({
  existing,
  groupId,
  parentSlug,
  orgSlug,
  nextOrder,
  onClose,
}: {
  existing: AffType | null
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
  const [accessLevel, setAccessLevel] = useState(existing?.access_level ?? 'limited')
  const [color, setColor] = useState(existing?.color ?? '#4f46e5')
  const [isDefault, setIsDefault] = useState(existing?.is_default ?? false)
  const [perms, setPerms] = useState<Record<string, boolean>>(() => {
    const p: Record<string, boolean> = {}
    for (const f of PERMISSION_FIELDS)
      p[f.key] = (existing as unknown as Record<string, boolean | null>)?.[f.key] ?? false
    return p
  })

  function handleSave() {
    setError('')
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    startTransition(async () => {
      const result = await upsertRoleType({
        id: existing?.id,
        groupId,
        name,
        slug: existing?.slug ?? slug,
        access_level: accessLevel,
        ...(perms as Record<string, boolean>),
        color,
        display_order: existing?.display_order ?? nextOrder,
        is_default: isDefault,
        parentSlug,
        orgSlug,
      } as Parameters<typeof upsertRoleType>[0])
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
      const result = await deleteRoleType({ id: existing.id, parentSlug, orgSlug })
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
        {existing ? 'Edit' : 'New'} Role Type
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
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Access level
          </label>
          <select
            value={accessLevel}
            onChange={(e) => setAccessLevel(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {ACCESS_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-20 rounded border border-input cursor-pointer"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground self-end pb-1">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-input"
          />
          Default for new members
        </label>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Permissions</p>
        <div className="space-y-2">
          {PERMISSION_FIELDS.map((f) => (
            <label key={f.key} className="flex items-start gap-2.5 py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={perms[f.key]}
                onChange={(e) => setPerms((p) => ({ ...p, [f.key]: e.target.checked }))}
                className="rounded border-input mt-0.5"
              />
              <div>
                <p className="text-sm text-foreground leading-tight">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between">
        <div>
          {existing && (
            <button
              onClick={handleDelete}
              className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1 transition-colors"
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
