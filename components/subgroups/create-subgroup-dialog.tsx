'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createSubgroup } from '@/actions/subgroups/manage-subgroup.action'
import { SUBGROUP_TYPE_LABELS } from '@/lib/constants/labels'
import { useOrg } from '@/lib/context/org-context'

const SUBGROUP_TYPES = Object.entries(SUBGROUP_TYPE_LABELS)
  .filter(([key]) => key !== 'family_line') // can't manually create family lines
  .map(([value, label]) => ({ value, label }))

const MEMBERSHIP_TYPES = [
  { value: 'appointed', label: 'Appointed' },
  { value: 'elected', label: 'Elected' },
  { value: 'open', label: 'Open (self-join)' },
  { value: 'invite_only', label: 'Invite Only' },
]

export function CreateSubgroupButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand hover:bg-brand-hover text-brand-foreground text-sm font-medium rounded-lg transition-colors"
      >
        <Plus size={14} />
        New Subgroup
      </button>
      {open && <CreateSubgroupDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function CreateSubgroupDialog({ onClose }: { onClose: () => void }) {
  const { parentOrg, org } = useOrg()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('committee')
  const [membership, setMembership] = useState('appointed')
  const [isPrivate, setIsPrivate] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await createSubgroup({
        groupId: org.id,
        name,
        subgroup_type: type,
        membership_type: membership,
        is_private: isPrivate,
        parentSlug: parentOrg?.slug ?? null,
        orgSlug: org.slug,
      })
      if (!result.success) {
        setError(result.error ?? 'Failed to create')
        return
      }
      router.refresh()
      onClose()
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
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">New Subgroup</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-lg"
            >
              &times;
            </button>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Social Committee"
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {SUBGROUP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Membership
                </label>
                <select
                  value={membership}
                  onChange={(e) => setMembership(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {MEMBERSHIP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="rounded border-input"
              />
              Private (only members can see)
            </label>

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
              {isPending ? 'Creating\u2026' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
