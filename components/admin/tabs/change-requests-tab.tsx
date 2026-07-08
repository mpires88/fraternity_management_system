'use client'

import { Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { reviewChangeRequestAction } from '@/actions/profile/change-request.action'
import { MemberAvatar } from '@/components/shared/member-avatar'
import type { ChangeRequest } from '@/dal/change-requests'

const FIELD_LABELS: Record<string, string> = {
  school_email: 'School email',
  expected_grad_year: 'Class of',
  member_number: 'Badge number',
  initiation_date: 'Initiation date',
  bid_date: 'Bid date',
  major: 'Major',
  role_type_id: 'Role',
  status_id: 'Status',
}

export function ChangeRequestsTab({ requests }: { requests: ChangeRequest[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleReview(requestId: string, decision: 'approved' | 'rejected') {
    startTransition(async () => {
      const result = await reviewChangeRequestAction({ request_id: requestId, decision })
      if (result.success) router.refresh()
    })
  }

  if (requests.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">No pending change requests</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">Pending Requests ({requests.length})</h3>
      <div className="divide-y divide-border rounded-lg border border-border">
        {requests.map((cr) => (
          <div key={cr.id} className="flex items-center gap-4 px-4 py-3">
            <MemberAvatar
              src={cr.person?.profile_photo ?? null}
              fullName={cr.person?.full_name ?? 'Unknown'}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {cr.person?.full_name ?? 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground">
                {FIELD_LABELS[cr.field_name] ?? cr.field_name}:{' '}
                <span className="line-through">{cr.current_value || 'empty'}</span>
                {' → '}
                <span className="font-medium text-foreground">{cr.requested_value}</span>
              </p>
              {cr.reason && (
                <p className="text-xs text-muted-foreground mt-0.5 italic">
                  &ldquo;{cr.reason}&rdquo;
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleReview(cr.id, 'approved')}
                disabled={isPending}
                className="p-1.5 rounded-md bg-success/10 text-success hover:bg-success/20 disabled:opacity-50 transition-colors"
                title="Approve"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleReview(cr.id, 'rejected')}
                disabled={isPending}
                className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                title="Reject"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
