'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { checkInProspect, removeCheckIn } from '@/actions/recruitment.action'
import type { EventRow } from '@/dal/events'
import type { ProspectWithCounts } from '@/dal/recruitment'

type Props = {
  events: EventRow[]
  prospects: ProspectWithCounts[]
  canManage: boolean
  onAddEvent: (data: {
    title: string
    starts_at: string
    description?: string | null
    ends_at?: string | null
    location?: string | null
  }) => void
}

export function EventsPanel({ events, prospects, canManage, onAddEvent }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [checkInSearch, setCheckInSearch] = useState('')

  const [newEvent, setNewEvent] = useState({
    title: '',
    starts_at: '',
    description: '',
    location: '',
  })

  async function handleCheckIn(eventId: string, prospectId: string) {
    const result = await checkInProspect({ eventId, prospectId })
    if (result.success) startTransition(() => router.refresh())
  }

  async function handleRemoveCheckIn(eventId: string, prospectId: string) {
    const result = await removeCheckIn({ eventId, prospectId })
    if (result.success) startTransition(() => router.refresh())
  }

  function handleAddEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!newEvent.title.trim() || !newEvent.starts_at) return
    onAddEvent({
      title: newEvent.title.trim(),
      starts_at: newEvent.starts_at,
      description: newEvent.description.trim() || null,
      location: newEvent.location.trim() || null,
    })
    setNewEvent({ title: '', starts_at: '', description: '', location: '' })
    setShowAddEvent(false)
  }

  const activeProspects = prospects.filter((p) => p.status === 'prospect')
  const filteredProspects = checkInSearch
    ? activeProspects.filter((p) => p.full_name.toLowerCase().includes(checkInSearch.toLowerCase()))
    : activeProspects

  if (events.length === 0 && !canManage) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No recruitment events yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowAddEvent(!showAddEvent)}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Add Event
          </button>
        </div>
      )}

      {showAddEvent && (
        <form onSubmit={handleAddEvent} className="rounded-lg border border-border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label htmlFor="ev-title" className="text-sm font-medium text-muted-foreground">
                Title *
              </label>
              <input
                id="ev-title"
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="ev-date" className="text-sm font-medium text-muted-foreground">
                Date & Time *
              </label>
              <input
                id="ev-date"
                type="datetime-local"
                value={newEvent.starts_at}
                onChange={(e) => setNewEvent({ ...newEvent, starts_at: e.target.value })}
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="ev-location" className="text-sm font-medium text-muted-foreground">
                Location
              </label>
              <input
                id="ev-location"
                type="text"
                value={newEvent.location}
                onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="ev-desc" className="text-sm font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                id="ev-desc"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddEvent(false)}
              className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newEvent.title.trim() || !newEvent.starts_at}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Create Event
            </button>
          </div>
        </form>
      )}

      {events.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No recruitment events yet. Click "Add Event" to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const isExpanded = expandedEvent === event.id
            const eventDate = new Date(event.starts_at)
            const isPast = eventDate < new Date()

            return (
              <div key={event.id} className="rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <div className="font-medium text-sm">{event.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {eventDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {event.location && ` · ${event.location}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPast && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Past
                      </span>
                    )}
                    <svg
                      className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && canManage && (
                  <div className="border-t border-border px-4 py-3 space-y-3">
                    {event.description && (
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    )}

                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        Check In Prospects
                      </div>
                      <input
                        type="text"
                        value={checkInSearch}
                        onChange={(e) => setCheckInSearch(e.target.value)}
                        placeholder="Search prospects..."
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-2"
                      />
                      {filteredProspects.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No active prospects.</p>
                      ) : (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {filteredProspects.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30"
                            >
                              <span className="text-sm">{p.full_name}</span>
                              <button
                                type="button"
                                onClick={() => handleCheckIn(event.id, p.id)}
                                disabled={isPending}
                                className="text-xs px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                Check In
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
