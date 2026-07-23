'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import {
  applyCredit,
  approveReimbursement,
  getCreditTargetsForPerson,
  getProposalLineItems,
  getReceiptUrls,
  reimburse,
  rejectReimbursement,
  submitReimbursement,
  withdrawReimbursement,
} from '@/actions/reimbursements.action'
import type { ReimbursementWithDetails } from '@/dal/reimbursements'
import { createClient } from '@/lib/supabase/client'

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  approved: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  reimbursed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  credited: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
}

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  reimbursed: 'Paid Out',
  credited: 'Credited',
}

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024 // matches the bucket's file_size_limit

/** Today in the user's local timezone (toISOString would shift to UTC and
 * date-stamp an evening US expense as tomorrow). */
const todayLocal = () => new Date().toLocaleDateString('en-CA')

type Proposal = { id: string; budget_title: string; label: string }

type Props = {
  reimbursements: ReimbursementWithDetails[]
  isTreasurer: boolean
  personId: string
  myPositionIds: string[]
  proposals: Proposal[]
  termId: string | null
}

export function ReimbursementList({
  reimbursements,
  isTreasurer,
  personId,
  myPositionIds,
  proposals,
  termId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showSubmit, setShowSubmit] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'active' | 'resolved'>('active')

  const active = reimbursements.filter((r) => ['submitted', 'approved'].includes(r.status))
  const resolved = reimbursements.filter((r) =>
    ['rejected', 'reimbursed', 'credited'].includes(r.status)
  )
  const shown = filter === 'active' ? active : resolved

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          <FilterButton active={filter === 'active'} onClick={() => setFilter('active')}>
            Active ({active.length})
          </FilterButton>
          <FilterButton active={filter === 'resolved'} onClick={() => setFilter('resolved')}>
            Resolved ({resolved.length})
          </FilterButton>
        </div>
        <button
          type="button"
          onClick={() => setShowSubmit(!showSubmit)}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Request Reimbursement
        </button>
      </div>

      {actionError && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">
          {actionError}
        </div>
      )}

      {showSubmit && (
        <SubmitForm
          proposals={proposals}
          personId={personId}
          termId={termId}
          onSubmitted={() => {
            setShowSubmit(false)
            startTransition(() => router.refresh())
          }}
          onCancel={() => setShowSubmit(false)}
          onError={setActionError}
        />
      )}

      {shown.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {filter === 'active' ? 'No pending reimbursement requests.' : 'No resolved requests yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <ReimbursementCard
              key={r.id}
              item={r}
              isTreasurer={isTreasurer}
              isOwner={r.submitted_by === personId}
              isAreaOfficer={
                !!r.proposal_position_id && myPositionIds.includes(r.proposal_position_id)
              }
              onAction={() => {
                setActionError(null)
                startTransition(() => router.refresh())
              }}
              onError={setActionError}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Submit Form ────────────────────────────────────────────────────────────

function SubmitForm({
  proposals,
  personId,
  termId,
  onSubmitted,
  onCancel,
  onError,
}: {
  proposals: Proposal[]
  personId: string
  termId: string | null
  onSubmitted: () => void
  onCancel: () => void
  onError: (msg: string) => void
}) {
  const [form, setForm] = useState({
    amount: '',
    description: '',
    occurred_on: todayLocal(),
    proposal_id: '',
  })
  const [uploading, setUploading] = useState(false)
  const [receiptPaths, setReceiptPaths] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    if (file.size > MAX_RECEIPT_BYTES) {
      onError('Receipt file is too large — the limit is 10 MB')
      return
    }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${personId}/${Date.now()}.${ext}`
      const supabase = createClient()
      const { error } = await supabase.storage
        .from('receipts')
        .upload(path, file, { contentType: file.type })
      if (error) {
        onError(`Upload failed: ${error.message}`)
        return
      }
      setReceiptPaths((prev) => [...prev, path])
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || !form.description) return
    setSubmitting(true)
    try {
      const result = await submitReimbursement({
        amount: Number.parseFloat(form.amount),
        description: form.description.trim(),
        occurred_on: form.occurred_on,
        receipt_paths: receiptPaths.length > 0 ? receiptPaths : null,
        proposal_id: form.proposal_id || null,
        term_id: termId,
      })
      if (result.success) {
        onSubmitted()
      } else {
        onError(result.error ?? 'Submit failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border p-4 space-y-4">
      <div className="text-sm font-medium">New Reimbursement Request</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="r-amount" className="text-sm text-muted-foreground">
            Amount ($) *
          </label>
          <input
            id="r-amount"
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="r-date" className="text-sm text-muted-foreground">
            Date of expense *
          </label>
          <input
            id="r-date"
            type="date"
            value={form.occurred_on}
            onChange={(e) => setForm({ ...form, occurred_on: e.target.value })}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="r-desc" className="text-sm text-muted-foreground">
            What did you buy? *
          </label>
          <input
            id="r-desc"
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Food for chapter event, printer ink, etc."
            required
            maxLength={1000}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {proposals.length > 0 && (
          <div className="sm:col-span-2">
            <label htmlFor="r-area" className="text-sm text-muted-foreground">
              Budget area (whose budget does this fall under?)
            </label>
            <select
              id="r-area"
              value={form.proposal_id}
              onChange={(e) => setForm({ ...form, proposal_id: e.target.value })}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">General / not sure</option>
              {proposals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.budget_title})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Your request goes to that area&apos;s officer for approval. If you pick General / not
              sure, it goes straight to the treasurer.
            </p>
          </div>
        )}
        <div className="sm:col-span-2">
          <span className="text-sm text-muted-foreground">Receipt photos</span>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {receiptPaths.map((path) => (
              <span
                key={path}
                className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1"
              >
                {path.split('/').pop()}
                <button
                  type="button"
                  aria-label={`Remove receipt ${path.split('/').pop()}`}
                  onClick={() => setReceiptPaths((prev) => prev.filter((p) => p !== path))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  &times;
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs px-2 py-1 rounded border border-dashed border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              {uploading ? 'Uploading...' : '+ Add receipt'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              aria-label="Upload receipt photo"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
                e.target.value = ''
              }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Attach a photo or PDF of each receipt — the officer and treasurer review these before
            paying out.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !form.amount || !form.description}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </div>
    </form>
  )
}

// ── Reimbursement Card ─────────────────────────────────────────────────────

function ReimbursementCard({
  item,
  isTreasurer,
  isOwner,
  isAreaOfficer,
  onAction,
  onError,
  isPending,
}: {
  item: ReimbursementWithDetails
  isTreasurer: boolean
  isOwner: boolean
  isAreaOfficer: boolean
  onAction: () => void
  onError: (msg: string) => void
  isPending: boolean
}) {
  const [showActions, setShowActions] = useState(false)
  const [resolveNote, setResolveNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [externalRef, setExternalRef] = useState('')
  const [acting, setActing] = useState(false)

  // Receipts: loaded lazily via signed URLs (the bucket is private)
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string> | null>(null)
  const [loadingReceipts, setLoadingReceipts] = useState(false)

  // Approve: optional pin to a budget line item of the linked proposal
  const [lineItems, setLineItems] = useState<Array<{
    id: string
    description: string
    amount: number
  }> | null>(null)
  const [pinLineItemId, setPinLineItemId] = useState('')

  // Credit: the SUBMITTER's own payment assignments, fetched on demand
  const [creditTargets, setCreditTargets] = useState<Array<{
    id: string
    title: string
  }> | null>(null)
  const [creditAssignmentId, setCreditAssignmentId] = useState('')

  async function act(fn: () => Promise<{ success: boolean; error?: string }>) {
    setActing(true)
    try {
      const result = await fn()
      if (result.success) {
        setShowActions(false)
        onAction()
      } else {
        onError(result.error ?? 'Operation failed')
      }
    } finally {
      setActing(false)
    }
  }

  async function handleShowReceipts() {
    if (!item.receipt_paths?.length || loadingReceipts) return
    setLoadingReceipts(true)
    try {
      const result = await getReceiptUrls({ paths: item.receipt_paths })
      if (result.success && result.data) {
        setReceiptUrls(result.data)
      } else {
        onError('Could not load the receipts')
      }
    } finally {
      setLoadingReceipts(false)
    }
  }

  async function handleOpenActions() {
    const next = !showActions
    setShowActions(next)
    if (!next) return
    // Prefetch the pickers the visible actions need
    if (canApprove && item.proposal_id && lineItems === null) {
      const result = await getProposalLineItems({ proposalId: item.proposal_id })
      if (result.success && result.data) setLineItems(result.data)
    }
    if (canResolve && creditTargets === null) {
      const result = await getCreditTargetsForPerson({ personId: item.submitted_by })
      if (result.success && result.data) setCreditTargets(result.data)
    }
  }

  // Approve = the linked area's officer or the treasurer (matches RLS — other
  // members' clicks would only fail server-side)
  const canApprove = item.status === 'submitted' && (isTreasurer || isAreaOfficer)
  const canReject =
    (item.status === 'submitted' && (isTreasurer || isAreaOfficer)) ||
    (item.status === 'approved' && isTreasurer)
  const canResolve = item.status === 'approved' && isTreasurer
  const canWithdraw = item.status === 'submitted' && isOwner

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">${item.amount.toFixed(2)}</span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status] ?? ''}`}
            >
              {STATUS_LABELS[item.status] ?? item.status}
            </span>
          </div>
          <div className="text-sm mt-1">{item.description}</div>
          <div className="text-xs text-muted-foreground mt-1 space-x-2">
            <span>by {item.submitter_name}</span>
            <span>&middot;</span>
            <span>{item.occurred_on}</span>
            {item.proposal_label && (
              <>
                <span>&middot;</span>
                <span>{item.proposal_label}</span>
              </>
            )}
          </div>
          {item.approved_by && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Approved by {item.approver_name}
              {item.line_item_description && ` · pinned to "${item.line_item_description}"`}
            </div>
          )}
          {item.resolved_by && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Resolved by {item.resolver_name}
              {item.resolution_note && ` — ${item.resolution_note}`}
            </div>
          )}
          {item.receipt_paths && item.receipt_paths.length > 0 && (
            <div className="text-xs mt-1">
              {receiptUrls ? (
                <span className="flex gap-2 flex-wrap">
                  {item.receipt_paths.map((path, i) =>
                    receiptUrls[path] ? (
                      <a
                        key={path}
                        href={receiptUrls[path]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Receipt {i + 1}
                      </a>
                    ) : (
                      <span key={path} className="text-muted-foreground">
                        Receipt {i + 1} (unavailable)
                      </span>
                    )
                  )}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleShowReceipts}
                  disabled={loadingReceipts}
                  className="text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                >
                  {loadingReceipts
                    ? 'Loading receipts…'
                    : `View ${item.receipt_paths.length} receipt${item.receipt_paths.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          )}
        </div>

        {(canApprove || canReject || canResolve || canWithdraw) && (
          <button
            type="button"
            onClick={handleOpenActions}
            disabled={isPending || acting}
            className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted transition-colors shrink-0"
          >
            Actions
          </button>
        )}
      </div>

      {showActions && (
        <div className="border-t border-border pt-3 space-y-3">
          {canApprove && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Approve — confirms this is a legitimate expense in your budget area; the treasurer
                then pays it out or applies it as a credit
              </div>
              {lineItems && lineItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <label htmlFor={`pin-${item.id}`} className="text-xs text-muted-foreground">
                    Budget line
                  </label>
                  <select
                    id={`pin-${item.id}`}
                    value={pinLineItemId}
                    onChange={(e) => setPinLineItemId(e.target.value)}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="">No specific line</option>
                    {lineItems.map((li) => (
                      <option key={li.id} value={li.id}>
                        {li.description} (${li.amount.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                disabled={acting}
                onClick={() =>
                  act(() =>
                    approveReimbursement({
                      id: item.id,
                      line_item_id: pinLineItemId || null,
                    })
                  )
                }
                className="text-sm px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                Approve
              </button>
            </div>
          )}

          {canResolve && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Resolve — pay out through your normal channel and record it here, or apply the
                amount as a credit against one of {item.submitter_name}&apos;s payment obligations
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Note (optional)"
                  aria-label="Resolution note"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
                <div className="flex gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={externalRef}
                      onChange={(e) => setExternalRef(e.target.value)}
                      placeholder="Ref # (optional)"
                      aria-label="External payment reference"
                      className="w-32 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() =>
                        act(() =>
                          reimburse({
                            id: item.id,
                            note: resolveNote || null,
                            external_ref: externalRef || null,
                          })
                        )
                      }
                      className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      Pay Out
                    </button>
                  </div>
                  {creditTargets && creditTargets.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={creditAssignmentId}
                        onChange={(e) => setCreditAssignmentId(e.target.value)}
                        aria-label="Payment obligation to credit"
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      >
                        <option value="">Pick their obligation...</option>
                        {creditTargets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={acting || !creditAssignmentId}
                        onClick={() => {
                          if (
                            !confirm(
                              `Apply $${item.amount.toFixed(2)} as a credit toward this obligation? This resolves the request and cannot be undone here.`
                            )
                          )
                            return
                          act(() =>
                            applyCredit({
                              id: item.id,
                              assignment_id: creditAssignmentId,
                              note: resolveNote || null,
                            })
                          )
                        }}
                        className="text-sm px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        Apply Credit
                      </button>
                    </div>
                  )}
                  {creditTargets && creditTargets.length === 0 && (
                    <span className="text-xs text-muted-foreground self-center">
                      {item.submitter_name} has no open payment obligations to credit — use Pay Out
                      instead.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {canReject && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason (the requester sees this)"
                aria-label="Rejection reason"
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={acting}
                onClick={() =>
                  act(() => rejectReimbursement({ id: item.id, note: rejectReason || null }))
                }
                className="text-sm px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </div>
          )}

          {canWithdraw && (
            <button
              type="button"
              disabled={acting}
              onClick={() => {
                if (!confirm('Withdraw this request? It is deleted and cannot be recovered.'))
                  return
                act(() => withdrawReimbursement({ id: item.id }))
              }}
              className="text-sm px-3 py-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            >
              Withdraw
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Filter Button ──────────────────────────────────────────────────────────

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-sm rounded transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}
