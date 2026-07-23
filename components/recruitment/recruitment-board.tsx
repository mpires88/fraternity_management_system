'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  createBatchBidVotes,
  createProspect,
  createRecruitmentEvent,
  deleteProspect,
  setProspectStatus,
} from '@/actions/recruitment.action'
import type { EventRow } from '@/dal/events'
import type { ProspectWithCounts } from '@/dal/recruitment'
import {
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_DESCRIPTIONS,
  PROSPECT_STATUS_LABELS,
} from '@/lib/constants/labels'
import { AddProspectDialog } from './add-prospect-dialog'
import { EventsPanel } from './events-panel'
import { ProspectTable } from './prospect-table'

const STATUS_ORDER = ['prospect', 'offered', 'accepted', 'declined', 'withdrawn'] as const
const STATUS_LABELS = PROSPECT_STATUS_LABELS
const STATUS_COLORS = PROSPECT_STATUS_COLORS

type Props = {
  prospects: ProspectWithCounts[]
  events: EventRow[]
  termId: string
  canManage: boolean
  basePath: string
  photoUrls: Record<string, string>
  roleTypes: Array<{ id: string; name: string }>
  candidateSubgroups: Array<{ id: string; name: string }>
  statuses: Array<{ id: string; name: string; slug: string }>
}

type Tab = 'pipeline' | 'events'

export function RecruitmentBoard({
  prospects,
  events,
  termId,
  canManage,
  basePath,
  photoUrls,
  roleTypes,
  candidateSubgroups,
  statuses,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<Tab>('pipeline')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [showStatusGuide, setShowStatusGuide] = useState(false)

  const byStatus = new Map<string, ProspectWithCounts[]>()
  for (const s of STATUS_ORDER) byStatus.set(s, [])
  for (const p of prospects) {
    const list = byStatus.get(p.status)
    if (list) list.push(p)
  }

  const filtered = statusFilter ? prospects.filter((p) => p.status === statusFilter) : prospects

  const undecided = prospects.filter((p) => p.status === 'prospect' && !p.poll_id)

  async function handleAddProspect(data: {
    full_name: string
    email?: string | null
    phone?: string | null
    school_year?: string | null
    is_legacy?: boolean
  }) {
    const result = await createProspect({ ...data, term_id: termId })
    if (result.success) {
      startTransition(() => router.refresh())
      setShowAddDialog(false)
    }
  }

  async function handleStatusChange(prospectId: string, status: string) {
    const result = await setProspectStatus({
      id: prospectId,
      status: status as 'prospect' | 'offered' | 'accepted' | 'declined' | 'withdrawn',
    })
    if (result.success) startTransition(() => router.refresh())
  }

  async function handleDelete(prospectId: string) {
    const result = await deleteProspect({ prospectId })
    if (result.success) startTransition(() => router.refresh())
  }

  async function handleOpenBidNight() {
    const ids = undecided.map((p) => p.id)
    if (ids.length === 0) return
    const result = await createBatchBidVotes({ prospectIds: ids, termId })
    if (result.success) startTransition(() => router.refresh())
  }

  async function handleAddEvent(data: {
    title: string
    starts_at: string
    description?: string | null
    ends_at?: string | null
    location?: string | null
  }) {
    const result = await createRecruitmentEvent({ ...data, term_id: termId })
    if (result.success) startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setActiveTab('pipeline')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'pipeline'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pipeline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'events'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Events ({events.length})
          </button>
        </div>

        {activeTab === 'pipeline' && (
          <div className="flex items-center gap-2">
            {/* Bid night is a manager action; adding a prospect is open to any member */}
            {canManage && undecided.length > 0 && (
              <button
                type="button"
                onClick={handleOpenBidNight}
                disabled={isPending}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                Open Bid Votes ({undecided.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAddDialog(true)}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Add Prospect
            </button>
          </div>
        )}
      </div>

      {/* Status chips + guide */}
      {activeTab === 'pipeline' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter(null)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                statusFilter === null
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              All ({prospects.length})
            </button>
            {STATUS_ORDER.map((s) => {
              const count = byStatus.get(s)?.length ?? 0
              if (count === 0 && s !== 'prospect') return null
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                  title={PROSPECT_STATUS_DESCRIPTIONS[s]}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                    statusFilter === s
                      ? STATUS_COLORS[s]
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {STATUS_LABELS[s]} ({count})
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setShowStatusGuide((v) => !v)}
              aria-expanded={showStatusGuide}
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" d="M12 11v5M12 8h.01" />
              </svg>
              What do these mean?
            </button>
          </div>

          {showStatusGuide && (
            <dl className="rounded-lg border border-border bg-muted/30 p-4 space-y-2.5">
              {STATUS_ORDER.map((s) => (
                <div key={s} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                  <dt className="shrink-0 sm:w-24">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[s]}`}
                    >
                      {STATUS_LABELS[s]}
                    </span>
                  </dt>
                  <dd className="text-xs text-muted-foreground sm:pt-0.5">
                    {PROSPECT_STATUS_DESCRIPTIONS[s]}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* Content */}
      {activeTab === 'pipeline' && (
        <ProspectTable
          prospects={filtered}
          canManage={canManage}
          basePath={basePath}
          photoUrls={photoUrls}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          isPending={isPending}
          roleTypes={roleTypes}
          candidateSubgroups={candidateSubgroups}
          statuses={statuses}
          termId={termId}
        />
      )}

      {activeTab === 'events' && (
        <EventsPanel
          events={events}
          prospects={prospects}
          canManage={canManage}
          onAddEvent={handleAddEvent}
        />
      )}

      {showAddDialog && (
        <AddProspectDialog onSubmit={handleAddProspect} onClose={() => setShowAddDialog(false)} />
      )}
    </div>
  )
}
