'use client'

import { CheckCircle, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  activateTerm,
  createTerm,
  deleteTermDefinition,
  upsertTermDefinition,
} from '@/actions/admin/update-settings.action'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminSettingsData } from '@/dal/admin'

type TermDef = AdminSettingsData['termDefinitions'][0]
type Term = AdminSettingsData['terms'][0]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function TermDefinitionsTab({ settings }: { settings: AdminSettingsData }) {
  const [editing, setEditing] = useState<TermDef | 'new' | null>(null)
  const [creatingTerm, setCreatingTerm] = useState<TermDef | null>(null)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Term Definitions</CardTitle>
              <CardDescription>
                Define your academic calendar structure (e.g. Fall, Spring).
              </CardDescription>
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
          {settings.termDefinitions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No term definitions yet. Add one to get started.
            </p>
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
                    <button
                      onClick={() => setCreatingTerm(t)}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                      title="Create term from this definition"
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      onClick={() => setEditing(t)}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {editing && (
            <TermDefForm
              existing={editing === 'new' ? null : editing}
              nextOrdinal={settings.termDefinitions.length + 1}
              onClose={() => setEditing(null)}
            />
          )}
          {creatingTerm && (
            <CreateTermForm definition={creatingTerm} onClose={() => setCreatingTerm(null)} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terms</CardTitle>
          <CardDescription>
            Created term instances. Activate a term to make it current.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings.terms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No terms created yet. Use the + button on a term definition above.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {settings.terms.map((t) => (
                <TermRow key={t.id} term={t} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TermDefForm({
  existing,
  nextOrdinal,
  onClose,
}: {
  existing: TermDef | null
  nextOrdinal: number
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [name, setName] = useState(existing?.name ?? '')
  const [startMonth, setStartMonth] = useState(existing?.start_month ?? 9)
  const [startDay, setStartDay] = useState(existing?.start_day ?? 1)
  const [endMonth, setEndMonth] = useState(existing?.end_month ?? 12)
  const [endDay, setEndDay] = useState(existing?.end_day ?? 31)
  const [hasElections, setHasElections] = useState(existing?.has_elections ?? true)
  const [hasBudget, setHasBudget] = useState(existing?.has_budget ?? true)
  const [hasRush, setHasRush] = useState(existing?.has_rush ?? false)

  function handleSave() {
    setError('')
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    startTransition(async () => {
      const result = await upsertTermDefinition({
        id: existing?.id,
        name,
        slug: existing?.slug ?? slug,
        ordinal: existing?.ordinal ?? nextOrdinal,
        start_month: startMonth,
        start_day: startDay,
        end_month: endMonth,
        end_day: endDay,
        has_elections: hasElections,
        has_budget: hasBudget,
        has_rush: hasRush,
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
      const result = await deleteTermDefinition({ id: existing.id })
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
        {existing ? 'Edit' : 'New'} Term Definition
      </h4>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Fall, Spring"
          required
          className="w-full max-w-xs px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Start (month/day)
          </label>
          <div className="flex gap-2">
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
              className="flex-1 px-2 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={31}
              value={startDay}
              onChange={(e) => setStartDay(Number(e.target.value))}
              className="w-16 px-2 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            End (month/day)
          </label>
          <div className="flex gap-2">
            <select
              value={endMonth}
              onChange={(e) => setEndMonth(Number(e.target.value))}
              className="flex-1 px-2 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={31}
              value={endDay}
              onChange={(e) => setEndDay(Number(e.target.value))}
              className="w-16 px-2 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={hasElections}
            onChange={(e) => setHasElections(e.target.checked)}
            className="rounded border-input"
          />
          Elections
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={hasBudget}
            onChange={(e) => setHasBudget(e.target.checked)}
            className="rounded border-input"
          />
          Budget
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={hasRush}
            onChange={(e) => setHasRush(e.target.checked)}
            className="rounded border-input"
          />
          Rush
        </label>
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
            disabled={isPending || !name}
            className="px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground text-sm rounded-lg font-medium transition-colors"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateTermForm({ definition, onClose }: { definition: TermDef; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [name, setName] = useState(`${definition.name} ${currentYear}`)

  const startsOn = `${year}-${String(definition.start_month).padStart(2, '0')}-${String(definition.start_day).padStart(2, '0')}`
  const endsYear = definition.end_month < definition.start_month ? year + 1 : year
  const endsOn = `${endsYear}-${String(definition.end_month).padStart(2, '0')}-${String(definition.end_day).padStart(2, '0')}`

  function handleCreate() {
    setError('')
    startTransition(async () => {
      const result = await createTerm({
        definition_id: definition.id,
        name,
        year,
        starts_on: startsOn,
        ends_on: endsOn,
      })
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
        Create Term from &ldquo;{definition.name}&rdquo;
      </h4>
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => {
              const y = Number(e.target.value)
              setYear(y)
              setName(`${definition.name} ${y}`)
            }}
            className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Dates: {startsOn} to {endsOn} &middot; Status: upcoming
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={isPending || !name}
          className="px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground text-sm rounded-lg font-medium transition-colors"
        >
          {isPending ? 'Creating…' : 'Create Term'}
        </button>
      </div>
    </div>
  )
}

function TermRow({ term }: { term: Term }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleActivate() {
    startTransition(async () => {
      const result = await activateTerm({ termId: term.id })
      if (!result.success) {
        setError(result.error ?? 'Failed')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{term.name}</p>
        <p className="text-xs text-muted-foreground">
          {term.starts_on} to {term.ends_on}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {term.status === 'active' ? (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">
            <CheckCircle size={10} className="mr-1" /> Active
          </Badge>
        ) : term.status === 'completed' ? (
          <Badge variant="secondary" className="text-[10px]">
            Completed
          </Badge>
        ) : (
          <>
            <Badge variant="outline" className="text-[10px]">
              Upcoming
            </Badge>
            <button
              onClick={handleActivate}
              disabled={isPending}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-brand hover:text-brand-hover transition-colors"
              title="Set as active term"
            >
              <Play size={11} /> {isPending ? 'Activating…' : 'Activate'}
            </button>
          </>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  )
}
