'use client'

import { Archive, Pencil, Plus, RefreshCw, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  archiveRequirement,
  createRequirement,
  syncRequirementAssignments,
  updateRequirement,
} from '@/actions/requirements/manage-requirement.action'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { RequirementRow } from '@/dal/requirements'

type AudienceOption = { id: string; name: string }

type Props = {
  requirements: RequirementRow[]
  termId: string
  termName: string
  roleTypes: AudienceOption[]
  positions: AudienceOption[]
  subgroups: AudienceOption[]
}

const KIND_LABELS: Record<string, string> = {
  task: 'Task',
  payment: 'Payment',
  attendance: 'Attendance',
  quota: 'Quota',
}

const ASSIGN_TO_LABELS: Record<string, string> = {
  all_active: 'All active',
  role_types: 'By role',
  positions: 'By position',
  subgroups: 'By subgroup',
  custom: 'Custom',
}

export function ManageRequirements({
  requirements,
  termId,
  termName,
  roleTypes,
  positions,
  subgroups,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RequirementRow | null>(null)

  const active = requirements.filter((r) => r.is_active)
  const archived = requirements.filter((r) => !r.is_active)

  function handleArchive(id: string) {
    startTransition(async () => {
      await archiveRequirement({ id })
      router.refresh()
    })
  }

  function handleSync(requirementId: string) {
    startTransition(async () => {
      await syncRequirementAssignments({ requirementId, termId })
      router.refresh()
    })
  }

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(req: RequirementRow) {
    setEditing(req)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Manage Requirements</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {termName} &middot; {active.length} active requirement{active.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} data-icon="inline-start" />
          New Requirement
        </Button>
      </div>

      {active.length === 0 && (
        <p className="text-muted-foreground">No requirements for this term yet.</p>
      )}

      {active.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Completion</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{req.title}</p>
                      {req.due_at && (
                        <p className="text-xs text-muted-foreground">
                          Due{' '}
                          {new Date(req.due_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{KIND_LABELS[req.kind] ?? req.kind}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {ASSIGN_TO_LABELS[req.assign_to] ?? req.assign_to}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users size={13} className="text-muted-foreground" />
                      <span className="text-sm">
                        {req.completed_assignments}/{req.total_assignments}
                      </span>
                      {req.total_assignments > 0 && (
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand rounded-full"
                            style={{
                              width: `${(req.completed_assignments / req.total_assignments) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => openEdit(req)}
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleSync(req.id)}
                        disabled={isPending}
                        title="Sync assignments"
                      >
                        <RefreshCw size={13} />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleArchive(req.id)}
                        disabled={isPending}
                        title="Archive"
                      >
                        <Archive size={13} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {archived.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer">
            {archived.length} archived requirement{archived.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 space-y-1">
            {archived.map((req) => (
              <p key={req.id} className="text-muted-foreground pl-4">
                {req.title} ({KIND_LABELS[req.kind]})
              </p>
            ))}
          </div>
        </details>
      )}

      {dialogOpen && (
        <RequirementDialog
          editing={editing}
          termId={termId}
          roleTypes={roleTypes}
          positions={positions}
          subgroups={subgroups}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  )
}

type DialogProps = {
  editing: RequirementRow | null
  termId: string
  roleTypes: AudienceOption[]
  positions: AudienceOption[]
  subgroups: AudienceOption[]
  onClose: () => void
}

type FormState = {
  title: string
  description: string
  kind: string
  due_at: string
  occurs_at: string
  amount_dollars: string
  quota_target: string
  quota_unit: string
  requires_verification: boolean
  assign_to: string
  audience_role_type_ids: string[]
  audience_position_ids: string[]
  audience_subgroup_ids: string[]
}

function RequirementDialog({
  editing,
  termId,
  roleTypes,
  positions,
  subgroups,
  onClose,
}: DialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [form, setForm] = useState<FormState>({
    title: editing?.title ?? '',
    description: editing?.description ?? '',
    kind: editing?.kind ?? 'task',
    due_at: editing?.due_at?.slice(0, 10) ?? '',
    occurs_at: editing?.occurs_at?.slice(0, 10) ?? '',
    amount_dollars: editing?.amount_cents ? (editing.amount_cents / 100).toString() : '',
    quota_target: editing?.quota_target?.toString() ?? '',
    quota_unit: editing?.quota_unit ?? '',
    requires_verification: editing?.requires_verification ?? false,
    assign_to: editing?.assign_to ?? 'all_active',
    audience_role_type_ids: editing?.audience_role_type_ids ?? [],
    audience_position_ids: editing?.audience_position_ids ?? [],
    audience_subgroup_ids: editing?.audience_subgroup_ids ?? [],
  })

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleArrayItem(
    key: 'audience_role_type_ids' | 'audience_position_ids' | 'audience_subgroup_ids',
    id: string
  ) {
    setForm((f) => {
      const arr = f[key]
      return { ...f, [key]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    startTransition(async () => {
      if (editing) {
        const result = await updateRequirement({
          id: editing.id,
          title: form.title,
          description: form.description || null,
          due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
          occurs_at: form.occurs_at ? new Date(form.occurs_at).toISOString() : null,
          amount_cents: form.amount_dollars ? Math.round(Number(form.amount_dollars) * 100) : null,
          quota_target: form.quota_target ? Number(form.quota_target) : null,
          quota_unit: form.quota_unit || null,
          requires_verification: form.requires_verification,
        })
        if (!result.success) {
          setError(result.error ?? 'Failed to update')
          return
        }
      } else {
        const result = await createRequirement({
          title: form.title,
          description: form.description || null,
          kind: form.kind as 'task',
          due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
          occurs_at: form.occurs_at ? new Date(form.occurs_at).toISOString() : null,
          amount_cents: form.amount_dollars ? Math.round(Number(form.amount_dollars) * 100) : null,
          quota_target: form.quota_target ? Number(form.quota_target) : null,
          quota_unit: form.quota_unit || null,
          requires_verification: form.requires_verification,
          assign_to: form.assign_to as 'all_active',
          audience_role_type_ids:
            form.assign_to === 'role_types' ? form.audience_role_type_ids : null,
          audience_position_ids: form.assign_to === 'positions' ? form.audience_position_ids : null,
          audience_subgroup_ids: form.assign_to === 'subgroups' ? form.audience_subgroup_ids : null,
          term_id: termId,
        })
        if (!result.success) {
          setError(result.error ?? 'Failed to create')
          return
        }
      }
      router.refresh()
      onClose()
    })
  }

  const isCreate = !editing

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              {isCreate ? 'New Requirement' : 'Edit Requirement'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-lg"
            >
              &times;
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                required
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand resize-none"
              />
            </div>

            {isCreate && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Kind</label>
                <select
                  value={form.kind}
                  onChange={(e) => update('kind', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="task">Task</option>
                  <option value="payment">Payment</option>
                  <option value="attendance">Attendance</option>
                  <option value="quota">Quota</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Due date
                </label>
                <input
                  type="date"
                  value={form.due_at}
                  onChange={(e) => update('due_at', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              {(form.kind === 'attendance' || editing?.kind === 'attendance') && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Event date
                  </label>
                  <input
                    type="date"
                    value={form.occurs_at}
                    onChange={(e) => update('occurs_at', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              )}
            </div>

            {(form.kind === 'payment' || editing?.kind === 'payment') && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount_dollars}
                  onChange={(e) => update('amount_dollars', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            )}

            {(form.kind === 'quota' || editing?.kind === 'quota') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Target
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.quota_target}
                    onChange={(e) => update('quota_target', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Unit (e.g. hours)
                  </label>
                  <input
                    type="text"
                    value={form.quota_unit}
                    onChange={(e) => update('quota_unit', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requires_verification"
                checked={form.requires_verification}
                onChange={(e) => update('requires_verification', e.target.checked)}
                className="rounded border-input"
              />
              <label htmlFor="requires_verification" className="text-sm text-foreground">
                Requires officer verification
              </label>
            </div>

            {isCreate && (
              <>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Assign to
                  </label>
                  <select
                    value={form.assign_to}
                    onChange={(e) => update('assign_to', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="all_active">All active members</option>
                    <option value="role_types">By role type</option>
                    <option value="positions">By position</option>
                    <option value="subgroups">By subgroup</option>
                  </select>
                </div>

                {form.assign_to === 'role_types' && roleTypes.length > 0 && (
                  <CheckboxGroup
                    label="Role types"
                    options={roleTypes}
                    selected={form.audience_role_type_ids}
                    onToggle={(id) => toggleArrayItem('audience_role_type_ids', id)}
                  />
                )}

                {form.assign_to === 'positions' && positions.length > 0 && (
                  <CheckboxGroup
                    label="Positions"
                    options={positions}
                    selected={form.audience_position_ids}
                    onToggle={(id) => toggleArrayItem('audience_position_ids', id)}
                  />
                )}

                {form.assign_to === 'subgroups' && subgroups.length > 0 && (
                  <CheckboxGroup
                    label="Subgroups"
                    options={subgroups}
                    selected={form.audience_subgroup_ids}
                    onToggle={(id) => toggleArrayItem('audience_subgroup_ids', id)}
                  />
                )}
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground text-sm rounded-lg font-medium transition-colors"
            >
              {isPending ? 'Saving…' : isCreate ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CheckboxGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: AudienceOption[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        {options.map((opt) => (
          <label key={opt.id} className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={selected.includes(opt.id)}
              onChange={() => onToggle(opt.id)}
              className="rounded border-input"
            />
            {opt.name}
          </label>
        ))}
      </div>
    </div>
  )
}
