'use client'

import { UserMinus, UserPlus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { addSubgroupMember, removeSubgroupMember } from '@/actions/subgroups/manage-subgroup.action'

type RosterPerson = { person_id: string; full_name: string }

type SubgroupMember = {
  id: string
  person_id: string
  full_name: string
}

export function AddSubgroupMemberButton({
  subgroupId,
  roster,
  existingMemberIds,
}: {
  subgroupId: string
  roster: RosterPerson[]
  existingMemberIds: string[]
}) {
  const [open, setOpen] = useState(false)
  const available = roster.filter((r) => !existingMemberIds.includes(r.person_id))

  if (available.length === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-hover text-brand-foreground text-sm rounded-lg font-medium transition-colors"
      >
        <UserPlus size={14} /> Add Member
      </button>
      {open && (
        <AddMemberDialog
          subgroupId={subgroupId}
          available={available}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function AddMemberDialog({
  subgroupId,
  available,
  onClose,
}: {
  subgroupId: string
  available: RosterPerson[]
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const filtered = available.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()))

  function handleAdd(personId: string) {
    setError('')
    startTransition(async () => {
      const result = await addSubgroupMember({ subgroupId, personId })
      if (!result.success) {
        setError(result.error ?? 'Failed to add member')
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
        className="bg-card rounded-xl shadow-xl w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Add Member</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roster…"
            className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div className="px-2 pb-3 max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-2">No members found.</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.person_id}
                onClick={() => handleAdd(p.person_id)}
                disabled={isPending}
                className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-50"
              >
                <UserPlus size={13} className="text-muted-foreground shrink-0" />
                {p.full_name}
              </button>
            ))
          )}
        </div>
        {error && <p className="text-sm text-destructive px-5 pb-3">{error}</p>}
      </div>
    </div>
  )
}

export function RemoveSubgroupMemberButton({ member }: { member: SubgroupMember }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleRemove() {
    startTransition(async () => {
      const result = await removeSubgroupMember({ membershipId: member.id })
      if (!result.success) return
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleRemove}
      disabled={isPending}
      className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors disabled:opacity-50"
      title={`Remove ${member.full_name}`}
    >
      <UserMinus size={13} />
    </button>
  )
}
