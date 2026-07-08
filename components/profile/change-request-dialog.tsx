'use client'

import { useState, useTransition } from 'react'
import { submitChangeRequest } from '@/actions/profile/change-request.action'

export function ChangeRequestDialog({
  fieldName,
  fieldLabel,
  currentValue,
  groupId,
  onClose,
}: {
  fieldName: string
  fieldLabel: string
  currentValue: string | null
  groupId: string
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [requestedValue, setRequestedValue] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await submitChangeRequest({
        group_id: groupId,
        field_name: fieldName,
        current_value: currentValue,
        requested_value: requestedValue,
        reason: reason || undefined,
      })
      if (!result.success) {
        setError(result.error ?? 'Failed to submit request')
        return
      }
      setSubmitted(true)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {submitted ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm font-medium text-foreground mb-2">Request submitted</p>
            <p className="text-xs text-muted-foreground mb-4">
              An admin will review your change request for {fieldLabel}.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground text-sm rounded-lg font-medium transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Request Change</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Request a change to your {fieldLabel.toLowerCase()}
              </p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Current value
                </label>
                <p className="text-sm text-foreground px-3 py-2 bg-muted rounded-lg">
                  {currentValue || 'Not set'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Requested value
                </label>
                <input
                  type="text"
                  value={requestedValue}
                  onChange={(e) => setRequestedValue(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                />
              </div>
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
                disabled={isPending || !requestedValue}
                className="px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground text-sm rounded-lg font-medium transition-colors"
              >
                {isPending ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
