'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { assignRoom, endAssignment, swapResidents } from '@/actions/housing.action'
import type { FacilityWithRooms, RoomAssignment, RoomWithOccupants } from '@/dal/housing'

type Member = { id: string; name: string }
type Term = { id: string; name: string }

type Props = {
  facilities: FacilityWithRooms[]
  canManage: boolean
  members: Member[]
  terms: Term[]
  selectedTermId: string | null
  activeTermId: string | null
}

/** Today in the user's local timezone (toISOString shifts evening US dates
 * to tomorrow). */
const todayLocal = () => new Date().toLocaleDateString('en-CA')

/** The DB's capacity rule (see enforce_lottery_pick): ideal_capacity wins,
 * plain capacity is the fallback, both NULL means unlimited. */
const effectiveCapacity = (room: RoomWithOccupants) => room.ideal_capacity ?? room.capacity

const isCurrent = (a: RoomAssignment) => a.ends_on === null || a.ends_on >= todayLocal()

export function OccupancyView({
  facilities,
  canManage,
  members,
  terms,
  selectedTermId,
  activeTermId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [swapSource, setSwapSource] = useState<RoomAssignment | null>(null)

  const termId = selectedTermId ?? ''

  function refresh() {
    setActionError(null)
    startTransition(() => router.refresh())
  }

  function handleTermChange(newTermId: string) {
    const url = new URL(window.location.href)
    url.searchParams.set('term', newTermId)
    router.push(url.pathname + url.search)
  }

  const totalRooms = facilities.reduce((s, f) => s + f.rooms.filter((r) => r.is_active).length, 0)
  const occupiedBeds = facilities.reduce(
    (s, f) =>
      s +
      f.rooms
        .filter((r) => r.is_active)
        .reduce((rs, r) => rs + r.occupants.filter(isCurrent).length, 0),
    0
  )
  const viewingPastTerm = activeTermId !== null && termId !== activeTermId

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {terms.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="occupancy-term" className="text-sm text-muted-foreground">
                Term
              </label>
              <select
                id="occupancy-term"
                value={termId}
                onChange={(e) => handleTermChange(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <span className="text-sm text-muted-foreground">
            {occupiedBeds} resident{occupiedBeds !== 1 ? 's' : ''} across {totalRooms} room
            {totalRooms !== 1 ? 's' : ''}
          </span>
          {viewingPastTerm && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              Viewing a non-active term — assignments you make here land in this term
            </span>
          )}
        </div>

        {swapSource ? (
          <div className="flex items-center gap-2 text-sm bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-md">
            <span>
              Swapping {swapSource.member_name} — now click &quot;Swap here&quot; on the resident to
              trade rooms with
            </span>
            <button
              type="button"
              onClick={() => setSwapSource(null)}
              className="text-amber-600 hover:text-amber-800 dark:hover:text-amber-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          canManage && (
            <span className="text-xs text-muted-foreground">
              To trade two residents&apos; rooms: click Swap on one, then &quot;Swap here&quot; on
              the other.
            </span>
          )
        )}
      </div>

      {actionError && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">
          {actionError}
        </div>
      )}

      {facilities.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No facilities configured for this organization yet. An organization admin adds the house
          and its rooms under Admin → Housing before occupancy can be tracked here.
        </div>
      ) : (
        facilities.map((facility) => (
          <FacilitySection
            key={facility.id}
            facility={facility}
            canManage={canManage}
            members={members}
            termId={termId}
            swapSource={swapSource}
            onSwapStart={setSwapSource}
            onAction={refresh}
            onError={setActionError}
            isPending={isPending}
          />
        ))
      )}
    </div>
  )
}

// ── Facility Section ───────────────────────────────────────────────────────

function FacilitySection({
  facility,
  canManage,
  members,
  termId,
  swapSource,
  onSwapStart,
  onAction,
  onError,
  isPending,
}: {
  facility: FacilityWithRooms
  canManage: boolean
  members: Member[]
  termId: string
  swapSource: RoomAssignment | null
  onSwapStart: (a: RoomAssignment | null) => void
  onAction: () => void
  onError: (msg: string) => void
  isPending: boolean
}) {
  const activeRooms = facility.rooms.filter((r) => r.is_active)

  if (activeRooms.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-lg font-semibold">{facility.name}</h3>
        {facility.address && (
          <span className="text-sm text-muted-foreground">{facility.address}</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeRooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            canManage={canManage}
            members={members}
            termId={termId}
            swapSource={swapSource}
            onSwapStart={onSwapStart}
            onAction={onAction}
            onError={onError}
            isPending={isPending}
          />
        ))}
      </div>
    </div>
  )
}

// ── Room Card ──────────────────────────────────────────────────────────────

function RoomCard({
  room,
  canManage,
  members,
  termId,
  swapSource,
  onSwapStart,
  onAction,
  onError,
  isPending,
}: {
  room: RoomWithOccupants
  canManage: boolean
  members: Member[]
  termId: string
  swapSource: RoomAssignment | null
  onSwapStart: (a: RoomAssignment | null) => void
  onAction: () => void
  onError: (msg: string) => void
  isPending: boolean
}) {
  const [showAssign, setShowAssign] = useState(false)
  const [acting, setActing] = useState(false)

  const current = room.occupants.filter(isCurrent)
  const past = room.occupants.filter((o) => !isCurrent(o))
  const capacity = effectiveCapacity(room)
  const isFull = capacity !== null && current.length >= capacity

  const assignedMemberIds = new Set(current.map((o) => o.member_id))
  const availableMembers = members.filter((m) => !assignedMemberIds.has(m.id))

  async function act(fn: () => Promise<{ success: boolean; error?: string }>) {
    setActing(true)
    try {
      const result = await fn()
      if (result.success) {
        onAction()
      } else {
        onError(result.error ?? 'Operation failed')
      }
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-sm">{room.name}</span>
          {room.room_number && (
            <span className="text-xs text-muted-foreground ml-1.5">#{room.room_number}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {room.floor && <span className="text-xs text-muted-foreground">{room.floor}</span>}
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full ${
              isFull
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800/30 dark:text-zinc-400'
            }`}
          >
            {current.length}/{capacity ?? '—'}
          </span>
        </div>
      </div>

      {current.length > 0 ? (
        <div className="space-y-1">
          {current.map((occ) => (
            <div key={occ.id} className="flex items-center justify-between text-sm">
              <span>{occ.member_name}</span>
              {canManage && (
                <div className="flex items-center gap-1">
                  {swapSource && swapSource.id !== occ.id ? (
                    <button
                      type="button"
                      disabled={acting || isPending}
                      onClick={() =>
                        act(async () => {
                          const result = await swapResidents({
                            assignment_id_a: swapSource.id,
                            assignment_id_b: occ.id,
                          })
                          if (result.success) onSwapStart(null)
                          return result
                        })
                      }
                      className="text-xs px-1.5 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                      Swap here
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={acting || isPending}
                      onClick={() => onSwapStart(occ)}
                      className="text-xs px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      Swap
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={acting || isPending}
                    onClick={() => {
                      if (
                        !confirm(
                          `End ${occ.member_name}'s assignment to ${room.name} as of today? They stay in this term's history as a past resident; re-assign them if this was a mistake.`
                        )
                      )
                        return
                      act(() =>
                        endAssignment({
                          assignment_id: occ.id,
                          ends_on: todayLocal(),
                        })
                      )
                    }}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                  >
                    End
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Vacant</div>
      )}

      {past.length > 0 && (
        <div className="space-y-0.5 pt-1 border-t border-border/60">
          {past.map((occ) => (
            <div key={occ.id} className="text-xs text-muted-foreground line-through">
              {occ.member_name} <span className="no-underline">— ended {occ.ends_on}</span>
            </div>
          ))}
        </div>
      )}

      {canManage && !isFull && !showAssign && (
        <button
          type="button"
          onClick={() => setShowAssign(true)}
          className="text-xs text-primary hover:underline"
        >
          + Assign
        </button>
      )}

      {canManage && showAssign && (
        <AssignForm
          roomId={room.id}
          termId={termId}
          members={availableMembers}
          onAssigned={() => {
            setShowAssign(false)
            onAction()
          }}
          onCancel={() => setShowAssign(false)}
          onError={onError}
        />
      )}
    </div>
  )
}

// ── Assign Form ────────────────────────────────────────────────────────────

function AssignForm({
  roomId,
  termId,
  members,
  onAssigned,
  onCancel,
  onError,
}: {
  roomId: string
  termId: string
  members: Member[]
  onAssigned: () => void
  onCancel: () => void
  onError: (msg: string) => void
}) {
  const [memberId, setMemberId] = useState('')
  const [startsOn, setStartsOn] = useState(todayLocal())
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!memberId) return
    setSubmitting(true)
    try {
      const result = await assignRoom({
        room_id: roomId,
        member_id: memberId,
        term_id: termId,
        starts_on: startsOn,
        notes: notes.trim() || null,
      })
      if (result.success) {
        onAssigned()
      } else {
        onError(result.error ?? 'Assignment failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 pt-1 border-t border-border">
      <div>
        <label htmlFor={`assign-member-${roomId}`} className="text-xs text-muted-foreground">
          Resident
        </label>
        <select
          id={`assign-member-${roomId}`}
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          <option value="">Select member...</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`assign-starts-${roomId}`} className="text-xs text-muted-foreground">
          Move-in date
        </label>
        <input
          id={`assign-starts-${roomId}`}
          type="date"
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
          className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
        />
      </div>
      <div>
        <label htmlFor={`assign-notes-${roomId}`} className="text-xs text-muted-foreground">
          Note (optional — e.g. summer boarder rate tier)
        </label>
        <input
          id={`assign-notes-${roomId}`}
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Note"
          maxLength={1000}
          className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
        />
      </div>
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-2 py-1 text-muted-foreground hover:bg-muted rounded transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !memberId}
          className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Assigning...' : 'Assign'}
        </button>
      </div>
    </form>
  )
}
