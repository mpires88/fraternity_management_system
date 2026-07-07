'use client'

import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { deletePosition, upsertPosition } from '@/actions/admin/update-settings.action'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminSettingsData } from '@/dal/admin'
import { getLabel, POSITION_TYPE_LABELS } from '@/lib/constants/labels'

type Pos = AdminSettingsData['positions'][0]

export function PositionsTab({ settings }: { settings: AdminSettingsData }) {
  const [editing, setEditing] = useState<Pos | 'new' | null>(null)

  // Group by type
  const byType = new Map<string, Pos[]>()
  for (const p of settings.positions) {
    const t = p.type ?? 'other'
    if (!byType.has(t)) byType.set(t, [])
    byType.get(t)!.push(p)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Positions</CardTitle>
            <CardDescription>{settings.positions.length} positions defined.</CardDescription>
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
        {[...byType.entries()].map(([type, positions]) => (
          <div key={type} className="mb-6 last:mb-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {getLabel(POSITION_TYPE_LABELS, type)}
            </p>
            <div className="divide-y divide-border/50">
              {positions.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.officer_selection} · {p.permission_level ?? 'officer'}
                      {p.has_budget && ' · has budget'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.is_locked ? (
                      <Lock size={13} className="text-muted-foreground" />
                    ) : (
                      <button
                        onClick={() => setEditing(p)}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {editing && (
          <PositionForm
            existing={editing === 'new' ? null : editing}
            nextOrder={(settings.positions.length + 1) * 10}
            onClose={() => setEditing(null)}
          />
        )}
      </CardContent>
    </Card>
  )
}

function PositionForm({
  existing,
  nextOrder,
  onClose,
}: {
  existing: Pos | null
  nextOrder: number
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [type, setType] = useState(existing?.type ?? 'committee')
  const [permLevel, setPermLevel] = useState(existing?.permission_level ?? 'officer')
  const [selection, setSelection] = useState(existing?.officer_selection ?? 'elected')
  const [hasBudget, setHasBudget] = useState(existing?.has_budget ?? false)

  function handleSave() {
    setError('')
    const slug = title
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    startTransition(async () => {
      const result = await upsertPosition({
        id: existing?.id,
        title,
        slug: existing?.slug ?? slug,
        type,
        permission_level: permLevel,
        officer_selection: selection,
        has_budget: hasBudget,
        display_order: existing?.display_order ?? nextOrder,
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
      const result = await deletePosition({ id: existing.id })
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
        {existing ? 'Edit' : 'New'} Position
      </h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="exec">Executive</option>
            <option value="committee">Committee</option>
            <option value="house">House</option>
            <option value="board">Board</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Permission level
          </label>
          <select
            value={permLevel}
            onChange={(e) => setPermLevel(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="exec">Executive</option>
            <option value="officer">Officer</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Selection</label>
          <select
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="elected">Elected</option>
            <option value="appointed">Appointed</option>
            <option value="carried_over">Carried over</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={hasBudget}
          onChange={(e) => setHasBudget(e.target.checked)}
          className="rounded border-input"
        />
        Has budget allocation
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between">
        <div>
          {existing && !existing.is_locked && (
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
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
