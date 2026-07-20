'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  addFeedback,
  deleteFeedback,
  setProspectStatus,
  updateProspect,
} from '@/actions/recruitment.action'
import type { ProspectDetail } from '@/dal/recruitment'
import { PROSPECT_STATUS_COLORS, SCHOOL_YEAR_OPTIONS } from '@/lib/constants/labels'

type Props = {
  prospect: ProspectDetail
  canManage: boolean
}

export function ProspectDetailView({ prospect, canManage }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: prospect.full_name,
    email: prospect.email ?? '',
    phone: prospect.phone ?? '',
    school_year: prospect.school_year ?? '',
    is_legacy: prospect.is_legacy,
  })

  const [feedbackBody, setFeedbackBody] = useState('')
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null)

  async function handleSave() {
    const result = await updateProspect({
      id: prospect.id,
      full_name: editForm.full_name.trim(),
      email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null,
      school_year: editForm.school_year.trim() || null,
      is_legacy: editForm.is_legacy,
    })
    if (result.success) {
      setEditing(false)
      startTransition(() => router.refresh())
    }
  }

  async function handleStatusChange(status: string) {
    const result = await setProspectStatus({
      id: prospect.id,
      status: status as 'prospect' | 'offered' | 'accepted' | 'declined' | 'withdrawn',
    })
    if (result.success) startTransition(() => router.refresh())
  }

  async function handleAddFeedback(e: React.FormEvent) {
    e.preventDefault()
    if (!feedbackBody.trim()) return
    const result = await addFeedback({
      prospect_id: prospect.id,
      body: feedbackBody.trim(),
      rating: feedbackRating,
    })
    if (result.success) {
      setFeedbackBody('')
      setFeedbackRating(null)
      startTransition(() => router.refresh())
    }
  }

  async function handleDeleteFeedback(feedbackId: string) {
    const result = await deleteFeedback({ feedbackId })
    if (result.success) startTransition(() => router.refresh())
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: Info */}
      <div className="lg:col-span-2 space-y-6">
        {/* Details card */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Details</h2>
            {canManage && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">School Year</label>
                <select
                  value={editForm.school_year}
                  onChange={(e) => setEditForm({ ...editForm, school_year: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">Select...</option>
                  {SCHOOL_YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.is_legacy}
                  onChange={(e) => setEditForm({ ...editForm, is_legacy: e.target.checked })}
                  className="rounded border-input"
                />
                <span className="text-sm">Legacy candidate</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd>{prospect.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd>{prospect.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">School Year</dt>
                <dd>{prospect.school_year || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Legacy</dt>
                <dd>{prospect.is_legacy ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          )}
        </div>

        {/* Feedback */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <h2 className="font-semibold">Feedback ({prospect.feedback.length})</h2>

          {prospect.feedback.length > 0 && (
            <div className="space-y-3">
              {prospect.feedback.map((f) => (
                <div key={f.id} className="rounded-md bg-muted/50 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {f.author_name} · {new Date(f.created_at).toLocaleDateString()}
                      {f.rating != null && (
                        <span className="ml-2 font-medium text-foreground">{f.rating}/5</span>
                      )}
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteFeedback(f.id)}
                        disabled={isPending}
                        className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-sm">{f.body}</p>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddFeedback} className="space-y-2">
            <textarea
              value={feedbackBody}
              onChange={(e) => setFeedbackBody(e.target.value)}
              placeholder="Share your thoughts on this prospect..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rating:</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFeedbackRating(feedbackRating === n ? null : n)}
                    className={`w-7 h-7 text-xs rounded-md border transition-colors ${
                      feedbackRating === n
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input hover:bg-muted'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={!feedbackBody.trim() || isPending}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right: Sidebar */}
      <div className="space-y-6">
        {/* Status */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold">Status</h3>
          <span
            className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${PROSPECT_STATUS_COLORS[prospect.status] ?? ''}`}
          >
            {prospect.status}
          </span>
          {canManage && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {prospect.status === 'prospect' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('offered')}
                  disabled={isPending}
                  className="text-xs px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  Offer Bid
                </button>
              )}
              {prospect.status === 'prospect' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('withdrawn')}
                  disabled={isPending}
                  className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                >
                  Withdraw
                </button>
              )}
              {prospect.status === 'offered' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('declined')}
                  disabled={isPending}
                  className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                >
                  Declined
                </button>
              )}
            </div>
          )}
        </div>

        {/* Attendance */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold">Event Attendance ({prospect.attendance.length})</h3>
          {prospect.attendance.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events attended.</p>
          ) : (
            <div className="space-y-2">
              {prospect.attendance.map((a) => (
                <div key={a.id} className="text-sm">
                  <div className="font-medium">{a.event_title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()} · by {a.checked_in_by_name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
