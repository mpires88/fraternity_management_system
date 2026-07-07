'use client'

import { Calendar, CheckCircle2, Circle, Clock, DollarSign, Hash, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { updateAssignmentStatus } from '@/actions/requirements/manage-requirement.action'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { AssignmentRow } from '@/dal/requirements'

type Props = {
  assignments: AssignmentRow[]
  termName: string
}

const STATUS_ORDER = ['pending', 'in_progress', 'complete', 'waived'] as const

function statusLabel(s: string) {
  switch (s) {
    case 'pending':
      return 'To Do'
    case 'in_progress':
      return 'In Progress'
    case 'complete':
      return 'Complete'
    case 'waived':
      return 'Waived'
    default:
      return s
  }
}

function statusVariant(s: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (s) {
    case 'complete':
    case 'waived':
      return 'secondary'
    case 'in_progress':
      return 'outline'
    default:
      return 'default'
  }
}

function kindIcon(kind: string) {
  switch (kind) {
    case 'payment':
      return <DollarSign size={14} />
    case 'attendance':
      return <Calendar size={14} />
    case 'quota':
      return <Hash size={14} />
    default:
      return <Circle size={14} />
  }
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export function MyRequirements({ assignments, termName }: Props) {
  const grouped = new Map<string, AssignmentRow[]>()
  for (const s of STATUS_ORDER) grouped.set(s, [])
  const pendingBucket = grouped.get('pending') as AssignmentRow[]
  for (const a of assignments) {
    const bucket = grouped.get(a.status) ?? pendingBucket
    bucket.push(a)
  }

  const completed = assignments.filter((a) => a.status === 'complete' || a.status === 'waived')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Requirements</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {termName} &middot; {completed.length} of {assignments.length} complete
        </p>
        {assignments.length > 0 && (
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all"
              style={{ width: `${(completed.length / assignments.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      {assignments.length === 0 && (
        <p className="text-muted-foreground">No requirements assigned to you this term.</p>
      )}

      {STATUS_ORDER.filter((s) => (grouped.get(s)?.length ?? 0) > 0).map((status) => (
        <div key={status}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {statusLabel(status)} ({grouped.get(status)?.length})
          </h2>
          <div className="space-y-2">
            {grouped.get(status)?.map((a) => (
              <AssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function AssignmentCard({ assignment: a }: { assignment: AssignmentRow }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const req = a.requirement
  const isDone = a.status === 'complete' || a.status === 'waived'

  function markComplete() {
    startTransition(async () => {
      await updateAssignmentStatus({ assignmentId: a.id, status: 'complete' })
      router.refresh()
    })
  }

  return (
    <Card className={isDone ? 'opacity-60' : ''}>
      <CardContent className="flex items-center gap-4 py-3 px-4">
        <div className="shrink-0 text-muted-foreground">{kindIcon(req.kind)}</div>

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}
          >
            {req.title}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {req.due_at && (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                Due {formatDate(req.due_at)}
              </span>
            )}
            {req.occurs_at && (
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {formatDate(req.occurs_at)}
              </span>
            )}
            {req.kind === 'payment' && req.amount_cents && (
              <span>{formatCents(req.amount_cents)}</span>
            )}
            {req.kind === 'quota' && req.quota_target && (
              <span>
                {a.progress} / {req.quota_target} {req.quota_unit ?? ''}
              </span>
            )}
            {req.requires_verification && (
              <span className="flex items-center gap-1">
                <ShieldCheck size={11} />
                Needs verification
              </span>
            )}
          </div>

          {req.kind === 'quota' && req.quota_target && !isDone && (
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all"
                style={{ width: `${Math.min((a.progress / req.quota_target) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={statusVariant(a.status)}>{statusLabel(a.status)}</Badge>
          {!isDone && req.kind === 'task' && !req.requires_verification && (
            <Button size="xs" variant="outline" onClick={markComplete} disabled={isPending}>
              <CheckCircle2 size={13} />
              Done
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
