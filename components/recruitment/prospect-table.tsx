'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { convertProspect, createBidVote } from '@/actions/recruitment.action'
import { MemberAvatar } from '@/components/shared/member-avatar'
import type { ProspectWithCounts } from '@/dal/recruitment'
import { PROSPECT_STATUS_COLORS } from '@/lib/constants/labels'

type Props = {
  prospects: ProspectWithCounts[]
  canManage: boolean
  basePath: string
  photoUrls: Record<string, string>
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  isPending: boolean
  roleTypes: Array<{ id: string; name: string }>
  candidateSubgroups: Array<{ id: string; name: string }>
  statuses: Array<{ id: string; name: string; slug: string }>
  termId: string
}

export function ProspectTable({
  prospects,
  canManage,
  basePath,
  photoUrls,
  onStatusChange,
  onDelete,
  isPending,
  roleTypes,
  candidateSubgroups,
  statuses,
  termId,
}: Props) {
  const router = useRouter()
  const [convertPending, startConvertTransition] = useTransition()
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [convertForm, setConvertForm] = useState<{
    prospectId: string
    roleTypeId: string
    statusId: string
    subgroupId: string | null
  } | null>(null)
  const [creatingVoteId, setCreatingVoteId] = useState<string | null>(null)

  if (prospects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No prospects yet. Click &quot;Add Prospect&quot; to get started.
      </div>
    )
  }

  async function handleCreateBidVote(prospectId: string) {
    if (creatingVoteId) return // double-click guard: one vote per prospect
    setCreatingVoteId(prospectId)
    try {
      const result = await createBidVote({ prospectId, termId })
      if (result.success) router.refresh()
    } finally {
      setCreatingVoteId(null)
    }
  }

  function openConvertDialog(prospectId: string) {
    const defaultRole = roleTypes[0]?.id ?? ''
    const activeStatus = statuses.find((s) => s.slug === 'active')
    setConvertForm({
      prospectId,
      roleTypeId: defaultRole,
      statusId: activeStatus?.id ?? statuses[0]?.id ?? '',
      subgroupId: candidateSubgroups[0]?.id ?? null,
    })
  }

  async function handleConvert() {
    if (!convertForm) return
    setConvertingId(convertForm.prospectId)
    const result = await convertProspect({
      prospect_id: convertForm.prospectId,
      role_type_id: convertForm.roleTypeId,
      status_id: convertForm.statusId,
      subgroup_id: convertForm.subgroupId,
    })
    if (result.success) {
      setConvertForm(null)
      startConvertTransition(() => router.refresh())
    }
    setConvertingId(null)
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Events</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Feedback</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vote</th>
              {canManage && (
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {prospects.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <MemberAvatar src={photoUrls[p.id] ?? null} fullName={p.full_name} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`${basePath}/recruitment/${p.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {p.full_name}
                        </Link>
                        {p.is_legacy && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            Legacy
                          </span>
                        )}
                      </div>
                      {p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${PROSPECT_STATUS_COLORS[p.status] ?? ''}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center tabular-nums">{p.attendance_count}</td>
                <td className="px-4 py-3 text-center tabular-nums">{p.feedback_count}</td>
                <td className="px-4 py-3">
                  {p.poll_id ? (
                    <Link
                      href={`${basePath}/polls`}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View ballot
                    </Link>
                  ) : p.status === 'prospect' && canManage ? (
                    <button
                      type="button"
                      onClick={() => handleCreateBidVote(p.id)}
                      disabled={isPending || creatingVoteId !== null}
                      className="text-xs text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50"
                    >
                      {creatingVoteId === p.id ? 'Creating…' : 'Create vote'}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.status === 'offered' && (
                        <button
                          type="button"
                          onClick={() => openConvertDialog(p.id)}
                          disabled={isPending || convertPending}
                          className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          Convert
                        </button>
                      )}
                      {p.status === 'prospect' && (
                        <button
                          type="button"
                          onClick={() => onStatusChange(p.id, 'withdrawn')}
                          disabled={isPending}
                          className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                        >
                          Withdraw
                        </button>
                      )}
                      {p.status === 'offered' && (
                        <button
                          type="button"
                          onClick={() => onStatusChange(p.id, 'declined')}
                          disabled={isPending}
                          className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                        >
                          Decline
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove ${p.full_name}?`)) onDelete(p.id)
                        }}
                        disabled={isPending}
                        className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Convert dialog */}
      {convertForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg border border-border shadow-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Convert to Member</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Role</label>
                <select
                  value={convertForm.roleTypeId}
                  onChange={(e) => setConvertForm({ ...convertForm, roleTypeId: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {roleTypes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <select
                  value={convertForm.statusId}
                  onChange={(e) => setConvertForm({ ...convertForm, statusId: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {candidateSubgroups.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Candidate Class
                  </label>
                  <select
                    value={convertForm.subgroupId ?? ''}
                    onChange={(e) =>
                      setConvertForm({ ...convertForm, subgroupId: e.target.value || null })
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">None</option>
                    {candidateSubgroups.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConvertForm(null)}
                className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConvert}
                disabled={convertingId === convertForm.prospectId}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {convertingId === convertForm.prospectId ? 'Converting...' : 'Convert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
