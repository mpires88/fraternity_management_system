'use client'

import { Check, CheckCheck, DollarSign, ShieldCheck, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  approveProgressEntry,
  bulkMarkAttendance,
  recordPayment,
  rejectProgressEntry,
  updateAssignmentStatus,
  verifyAssignment,
  waiveAssignment,
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
import type { ProgressEntryRow, RequirementDetailRow } from '@/dal/requirements'

type Requirement = {
  id: string
  title: string
  description: string | null
  kind: string
  due_at: string | null
  occurs_at: string | null
  amount_cents: number | null
  quota_target: number | null
  quota_unit: string | null
  requires_verification: boolean
  assign_to: string
  is_active: boolean
}

type PendingEntry = ProgressEntryRow & {
  person_name: string
  assignment_progress: number
}

type Props = {
  requirement: Requirement
  assignees: RequirementDetailRow[]
  pendingEntries: PendingEntry[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  complete: 'Complete',
  waived: 'Waived',
}

function statusVariant(s: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (s) {
    case 'complete':
      return 'secondary'
    case 'waived':
      return 'outline'
    case 'submitted':
      return 'default'
    default:
      return 'outline'
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function RequirementDetailView({ requirement: req, assignees, pendingEntries }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [waiveId, setWaiveId] = useState<string | null>(null)
  const [waiveNote, setWaiveNote] = useState('')
  const [paymentTarget, setPaymentTarget] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')

  const completed = assignees.filter((a) => a.status === 'complete' || a.status === 'waived')
  const isAttendance = req.kind === 'attendance'
  const isPayment = req.kind === 'payment'
  const pendingAssignees = assignees.filter((a) => a.status !== 'complete' && a.status !== 'waived')

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === pendingAssignees.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pendingAssignees.map((a) => a.id)))
    }
  }

  function handleBulkAttendance() {
    const ids = [...selected]
    if (ids.length === 0) return
    startTransition(async () => {
      await bulkMarkAttendance({ assignmentIds: ids })
      setSelected(new Set())
      router.refresh()
    })
  }

  function handleMarkComplete(assignmentId: string) {
    startTransition(async () => {
      await updateAssignmentStatus({ assignmentId, status: 'complete' })
      router.refresh()
    })
  }

  function handleVerify(assignmentId: string) {
    startTransition(async () => {
      await verifyAssignment({ assignmentId })
      router.refresh()
    })
  }

  function handleWaive() {
    if (!waiveId) return
    startTransition(async () => {
      await waiveAssignment({ assignmentId: waiveId, note: waiveNote })
      setWaiveId(null)
      setWaiveNote('')
      router.refresh()
    })
  }

  function handleRecordPayment() {
    if (!paymentTarget) return
    const cents = Math.round(Number.parseFloat(paymentAmount) * 100)
    if (Number.isNaN(cents) || cents <= 0) return
    startTransition(async () => {
      await recordPayment({
        assignmentId: paymentTarget,
        amount: cents,
        occurredOn: new Date().toISOString().slice(0, 10),
        note: paymentNote || null,
      })
      setPaymentTarget(null)
      setPaymentAmount('')
      setPaymentNote('')
      router.refresh()
    })
  }

  function handleApprove(entryId: string) {
    startTransition(async () => {
      await approveProgressEntry({ entryId })
      router.refresh()
    })
  }

  function handleReject(entryId: string) {
    startTransition(async () => {
      await rejectProgressEntry({ entryId })
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{req.title}</h1>
          <Badge variant="outline">{req.kind}</Badge>
          {!req.is_active && <Badge variant="destructive">Archived</Badge>}
        </div>
        {req.description && <p className="text-sm text-muted-foreground mt-1">{req.description}</p>}
        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          {req.due_at && <span>Due {formatDate(req.due_at)}</span>}
          {req.occurs_at && <span>Event {formatDate(req.occurs_at)}</span>}
          {isPayment && req.amount_cents && <span>${(req.amount_cents / 100).toFixed(2)}</span>}
          {req.kind === 'quota' && req.quota_target && (
            <span>
              Target: {req.quota_target} {req.quota_unit ?? ''}
            </span>
          )}
          {req.requires_verification && (
            <span className="flex items-center gap-1">
              <ShieldCheck size={13} />
              Requires verification
            </span>
          )}
          <span>
            {completed.length}/{assignees.length} complete
          </span>
        </div>
      </div>

      {isAttendance && pendingAssignees.length > 0 && (
        <div className="flex items-center gap-3">
          <Button onClick={handleBulkAttendance} disabled={selected.size === 0 || isPending}>
            <CheckCheck size={14} data-icon="inline-start" />
            Mark {selected.size} present
          </Button>
          <Button variant="outline" size="sm" onClick={toggleSelectAll}>
            {selected.size === pendingAssignees.length ? 'Deselect all' : 'Select all pending'}
          </Button>
        </div>
      )}

      {pendingEntries.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Pending Approval ({pendingEntries.length})
          </h3>
          <div className="space-y-2">
            {pendingEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{entry.person_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {req.kind === 'payment'
                      ? `$${(entry.amount / 100).toFixed(2)}`
                      : `${entry.amount} ${req.quota_unit ?? 'units'}`}
                    {' · '}
                    {formatDate(entry.occurred_on)}
                    {entry.note && ` · ${entry.note}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => handleApprove(entry.id)}
                    disabled={isPending}
                    title="Approve"
                  >
                    <ThumbsUp size={13} />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => handleReject(entry.id)}
                    disabled={isPending}
                    title="Reject"
                  >
                    <ThumbsDown size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {isAttendance && <TableHead className="w-10" />}
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              {req.kind === 'quota' && <TableHead>Progress</TableHead>}
              {isPayment && <TableHead>Paid</TableHead>}
              <TableHead>Completed</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignees.map((a) => {
              const isDone = a.status === 'complete' || a.status === 'waived'
              const isSubmitted = a.status === 'submitted'

              return (
                <TableRow key={a.id} className={isDone ? 'opacity-60' : ''}>
                  {isAttendance && (
                    <TableCell>
                      {!isDone && (
                        <input
                          type="checkbox"
                          checked={selected.has(a.id)}
                          onChange={() => toggleSelect(a.id)}
                          className="rounded border-input"
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{a.person_name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(a.status)}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </Badge>
                  </TableCell>
                  {req.kind === 'quota' && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {a.progress}/{req.quota_target}
                        </span>
                        {req.quota_target && req.quota_target > 0 && (
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand rounded-full"
                              style={{
                                width: `${Math.min((a.progress / req.quota_target) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {isPayment && (
                    <TableCell>
                      <span className="text-sm">
                        ${(a.progress / 100).toFixed(2)} / $
                        {((req.amount_cents ?? 0) / 100).toFixed(2)}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(a.completed_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {a.note ?? ''}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isSubmitted && req.requires_verification && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleVerify(a.id)}
                          disabled={isPending}
                          title="Verify & complete"
                        >
                          <ShieldCheck size={13} />
                          Verify
                        </Button>
                      )}
                      {isPayment && !isDone && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setPaymentTarget(a.id)
                            setPaymentAmount('')
                            setPaymentNote('')
                          }}
                          disabled={isPending}
                          title="Record payment"
                        >
                          <DollarSign size={13} />
                          Pay
                        </Button>
                      )}
                      {!isDone && !isSubmitted && !isPayment && (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleMarkComplete(a.id)}
                          disabled={isPending}
                          title="Mark complete"
                        >
                          <Check size={13} />
                        </Button>
                      )}
                      {!isDone && (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => {
                            setWaiveId(a.id)
                            setWaiveNote('')
                          }}
                          disabled={isPending}
                          title="Waive"
                        >
                          <X size={13} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {waiveId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setWaiveId(null)}
        >
          <div
            className="bg-card rounded-xl shadow-xl w-full max-w-sm mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground mb-3">Waive Requirement</h3>
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Reason (optional)
              </label>
              <textarea
                value={waiveNote}
                onChange={(e) => setWaiveNote(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                placeholder="Why is this being waived?"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setWaiveId(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleWaive} disabled={isPending}>
                {isPending ? 'Waiving…' : 'Waive'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {paymentTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPaymentTarget(null)}
        >
          <div
            className="bg-card rounded-xl shadow-xl w-full max-w-sm mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground mb-3">Record Payment</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="e.g. Check #1234"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setPaymentTarget(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleRecordPayment} disabled={isPending}>
                {isPending ? 'Recording…' : 'Record'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
