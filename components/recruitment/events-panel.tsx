'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { checkInProspect, updateRecruitmentCalendarHours } from '@/actions/recruitment.action'
import type { EventRow } from '@/dal/events'
import type { ProspectWithCounts, RecruitmentCalendarHours } from '@/dal/recruitment'

type Props = {
  events: EventRow[]
  prospects: ProspectWithCounts[]
  canManage: boolean
  canEditCalendar: boolean
  calendarHours: RecruitmentCalendarHours
  onAddEvent: (data: {
    title: string
    starts_at: string
    description?: string | null
    ends_at?: string | null
    location?: string | null
  }) => void
}

type ViewMode = 'list' | 'calendar'
type CalView = 'day' | 'week' | 'month'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Midnight of the Sunday that starts the week containing `d`. */
function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  s.setDate(s.getDate() - s.getDay())
  return s
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function eventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ── Time-grid geometry (day / week views) ────────────────────────────────────

const HOUR_PX = 44 // vertical pixels per hour
const MIN_EVENT_PX = 20 // floor so brief events stay legible/clickable
const DEFAULT_DURATION_MIN = 60 // assumed length when an event has no end time

/** Start/end Date of an event, defaulting the end when `ends_at` is missing. */
function eventBounds(e: EventRow): { start: Date; end: Date } {
  const start = new Date(e.starts_at)
  const end = e.ends_at
    ? new Date(e.ends_at)
    : new Date(start.getTime() + DEFAULT_DURATION_MIN * 60000)
  return { start, end }
}

/**
 * The [startHour, endHour] window to render. Starts from the admin-configured
 * window (default 8am–12am) and only widens to include events that fall outside
 * it, so a stray early/late event is never hidden.
 */
function hourRange(evts: EventRow[], bounds: [number, number]): [number, number] {
  let [minH, maxH] = bounds
  for (const e of evts) {
    const { start, end } = eventBounds(e)
    minH = Math.min(minH, start.getHours())
    let endH = end.getHours() + (end.getMinutes() > 0 ? 1 : 0)
    if (end <= start || endH <= start.getHours()) endH = 24 // crosses midnight → clamp
    maxH = Math.max(maxH, endH)
  }
  return [Math.max(0, minH), Math.min(24, Math.max(maxH, minH + 1))]
}

/** Hour-of-day label for gutter lines (0–23). */
function formatHour(h: number): string {
  const period = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr} ${period}`
}

/** Hour label for the settings picker, where 24 means midnight (12 AM). */
function hourLabel(h: number): string {
  if (h === 0 || h === 24) return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

type LaidEvent = { event: EventRow; topPx: number; heightPx: number; lane: number; cols: number }

/**
 * Position a single day's events on the vertical scale: absolute top/height by
 * time, and side-by-side lanes for any that overlap (so nothing is hidden).
 */
function layoutColumn(events: EventRow[], startHour: number): LaidEvent[] {
  const items = events
    .map((e) => {
      const { start, end } = eventBounds(e)
      return { e, s: start.getTime(), en: end.getTime() }
    })
    .sort((a, b) => a.s - b.s || a.en - b.en)

  const out: LaidEvent[] = []
  let cluster: (typeof items)[number][] = []
  let clusterEnd = Number.NEGATIVE_INFINITY

  const flush = () => {
    const laneEnds: number[] = []
    const laneOf = new Map<(typeof cluster)[number], number>()
    for (const it of cluster) {
      let lane = laneEnds.findIndex((t) => t <= it.s)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(it.en)
      } else {
        laneEnds[lane] = it.en
      }
      laneOf.set(it, lane)
    }
    const cols = laneEnds.length
    for (const it of cluster) {
      const d = new Date(it.e.starts_at)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHour).getTime()
      out.push({
        event: it.e,
        topPx: ((it.s - dayStart) / 3600000) * HOUR_PX,
        heightPx: Math.max(MIN_EVENT_PX, ((it.en - it.s) / 3600000) * HOUR_PX),
        lane: laneOf.get(it) ?? 0,
        cols,
      })
    }
    cluster = []
  }

  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.en)
  }
  if (cluster.length) flush()
  return out
}

export function EventsPanel({
  events,
  prospects,
  canManage,
  canEditCalendar,
  calendarHours,
  onAddEvent,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [checkInSearch, setCheckInSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [calView, setCalView] = useState<CalView>('month')
  // Anchor date for the calendar — the focused day/week/month depending on calView
  const [calRef, setCalRef] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const [newEvent, setNewEvent] = useState({
    title: '',
    starts_at: '',
    ends_at: '',
    description: '',
    location: '',
  })

  async function handleCheckIn(eventId: string, prospectId: string) {
    const result = await checkInProspect({ eventId, prospectId })
    if (result.success) startTransition(() => router.refresh())
  }

  function handleAddEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!newEvent.title.trim() || !newEvent.starts_at) return
    // Reject an end that isn't after the start rather than silently dropping it
    if (newEvent.ends_at && newEvent.ends_at <= newEvent.starts_at) return
    onAddEvent({
      title: newEvent.title.trim(),
      starts_at: newEvent.starts_at,
      ends_at: newEvent.ends_at || null,
      description: newEvent.description.trim() || null,
      location: newEvent.location.trim() || null,
    })
    setNewEvent({ title: '', starts_at: '', ends_at: '', description: '', location: '' })
    setShowAddEvent(false)
  }

  const activeProspects = prospects.filter((p) => p.status === 'prospect')
  const filteredProspects = checkInSearch
    ? activeProspects.filter((p) => p.full_name.toLowerCase().includes(checkInSearch.toLowerCase()))
    : activeProspects

  // Shared expanded-event body — description + prospect check-in — reused by
  // both the list and the calendar so check-in works identically in either view.
  function eventDetail(event: EventRow) {
    return (
      <div className="space-y-3">
        {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">Check In Prospects</div>
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
    )
  }

  if (events.length === 0 && !canManage) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No recruitment events yet. Once officers schedule rush events, you&apos;ll be able to check
        prospects in here as they arrive.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground max-w-prose">
          Rush week schedule. Open an event to check prospects in as they show up — any member can,
          straight from their phone. Check-in counts feed the pipeline so bid discussions have real
          attendance behind them.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Calendar
            </button>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowAddEvent(!showAddEvent)}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Add Event
            </button>
          )}
        </div>
      </div>

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
                Starts *
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
              <label htmlFor="ev-end" className="text-sm font-medium text-muted-foreground">
                Ends
              </label>
              <input
                id="ev-end"
                type="datetime-local"
                value={newEvent.ends_at}
                min={newEvent.starts_at || undefined}
                onChange={(e) => setNewEvent({ ...newEvent, ends_at: e.target.value })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional — sets the block length on the calendar (defaults to 1 hour).
              </p>
            </div>
            <div className="col-span-2">
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
          No recruitment events yet. Click &quot;Add Event&quot; to get started.
        </div>
      ) : viewMode === 'list' ? (
        <EventList
          events={events}
          expandedEvent={expandedEvent}
          onToggle={(id) => setExpandedEvent(expandedEvent === id ? null : id)}
          renderDetail={eventDetail}
        />
      ) : (
        <EventCalendar
          events={events}
          calRef={calRef}
          calView={calView}
          calendarHours={calendarHours}
          canEditCalendar={canEditCalendar}
          onView={setCalView}
          onNav={(delta) =>
            setCalRef((d) => {
              if (calView === 'month') return new Date(d.getFullYear(), d.getMonth() + delta, 1)
              const step = calView === 'week' ? 7 : 1
              return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta * step)
            })
          }
          onToday={() => {
            const now = new Date()
            setCalRef(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
          }}
          onPickDay={(date) => {
            setCalRef(date)
            setCalView('day')
          }}
          expandedEvent={expandedEvent}
          onSelect={(id) => setExpandedEvent(expandedEvent === id ? null : id)}
          renderDetail={eventDetail}
        />
      )}
    </div>
  )
}

// ── List view ─────────────────────────────────────────────────────────────

function EventList({
  events,
  expandedEvent,
  onToggle,
  renderDetail,
}: {
  events: EventRow[]
  expandedEvent: string | null
  onToggle: (id: string) => void
  renderDetail: (event: EventRow) => React.ReactNode
}) {
  return (
    <div className="space-y-3">
      {events.map((event) => {
        const isExpanded = expandedEvent === event.id
        const eventDate = new Date(event.starts_at)
        const isPast = eventDate < new Date()

        return (
          <div key={event.id} className="rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => onToggle(event.id)}
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

            {isExpanded && (
              <div className="border-t border-border px-4 py-3">{renderDetail(event)}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Calendar view ───────────────────────────────────────────────────────────

function EventCalendar({
  events,
  calRef,
  calView,
  calendarHours,
  canEditCalendar,
  onView,
  onNav,
  onToday,
  onPickDay,
  expandedEvent,
  onSelect,
  renderDetail,
}: {
  events: EventRow[]
  calRef: Date
  calView: CalView
  calendarHours: RecruitmentCalendarHours
  canEditCalendar: boolean
  onView: (view: CalView) => void
  onNav: (delta: number) => void
  onToday: () => void
  onPickDay: (date: Date) => void
  expandedEvent: string | null
  onSelect: (id: string) => void
  renderDetail: (event: EventRow) => React.ReactNode
}) {
  const router = useRouter()
  const today = new Date()
  const bounds: [number, number] = [calendarHours.start_hour, calendarHours.end_hour]

  const [showSettings, setShowSettings] = useState(false)
  const [savingHours, setSavingHours] = useState(false)
  const [formHours, setFormHours] = useState(calendarHours)
  const invalidHours = formHours.end_hour <= formHours.start_hour

  async function saveHours() {
    if (invalidHours) return
    setSavingHours(true)
    const res = await updateRecruitmentCalendarHours({
      start_hour: formHours.start_hour,
      end_hour: formHours.end_hour,
    })
    setSavingHours(false)
    if (res.success) {
      setShowSettings(false)
      router.refresh()
    }
  }

  // Events falling on a given calendar day, sorted by start time
  const eventsOnDay = (date: Date) =>
    events
      .filter((e) => sameDay(new Date(e.starts_at), date))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  // Header title adapts to the active view
  const weekStart = startOfWeek(calRef)
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6)
  let title: string
  if (calView === 'month') {
    title = calRef.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } else if (calView === 'week') {
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
    title = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(
      'en-US',
      sameMonth
        ? { day: 'numeric', year: 'numeric' }
        : { month: 'short', day: 'numeric', year: 'numeric' }
    )}`
  } else {
    title = calRef.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const selected = expandedEvent ? events.find((e) => e.id === expandedEvent) : null

  // A small event pill used in the month and week grids
  const eventPill = (event: EventRow) => (
    <button
      key={event.id}
      type="button"
      onClick={() => onSelect(event.id)}
      title={event.title}
      className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight transition-colors ${
        expandedEvent === event.id
          ? 'bg-primary text-primary-foreground'
          : 'bg-primary/10 text-primary hover:bg-primary/20'
      }`}
    >
      {eventTime(event.starts_at)} {event.title}
    </button>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          {/* Day / Week / Month toggle */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['day', 'week', 'month'] as CalView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onView(v)}
                className={`px-2 py-0.5 text-xs font-medium capitalize rounded-md transition-colors ${
                  calView === v
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToday}
              className="px-2 py-1 text-xs rounded-md text-muted-foreground hover:bg-muted transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => onNav(-1)}
              aria-label={`Previous ${calView}`}
              className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onNav(1)}
              aria-label={`Next ${calView}`}
              className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {canEditCalendar && (
            <button
              type="button"
              onClick={() => {
                setFormHours(calendarHours)
                setShowSettings((v) => !v)
              }}
              aria-label="Calendar hours settings"
              aria-expanded={showSettings}
              title="Calendar hours"
              className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {canEditCalendar && showSettings && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="cal-start"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Day starts
              </label>
              <select
                id="cal-start"
                value={formHours.start_hour}
                onChange={(e) =>
                  setFormHours((h) => ({ ...h, start_hour: Number(e.target.value) }))
                }
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="cal-end"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Day ends
              </label>
              <select
                id="cal-end"
                value={formHours.end_hour}
                onChange={(e) => setFormHours((h) => ({ ...h, end_hour: Number(e.target.value) }))}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={saveHours}
              disabled={savingHours || invalidHours}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {savingHours ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Sets the visible hours on the Day and Week views for everyone in this chapter.
            {invalidHours && (
              <span className="ml-1 text-destructive">End must be after start.</span>
            )}
          </p>
        </div>
      )}

      {calView === 'month' && (
        <MonthGrid
          calRef={calRef}
          today={today}
          eventsOnDay={eventsOnDay}
          onPickDay={onPickDay}
          eventPill={eventPill}
        />
      )}

      {calView === 'week' &&
        (() => {
          const days = Array.from(
            { length: 7 },
            (_, i) =>
              new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)
          )
          const weekEvents = days.flatMap((d) => eventsOnDay(d))
          const [startHour, endHour] = hourRange(weekEvents, bounds)
          return (
            <TimeGrid
              startHour={startHour}
              endHour={endHour}
              expandedEvent={expandedEvent}
              onSelect={onSelect}
              minWidthClass="min-w-[640px]"
              columns={days.map((day, i) => ({
                key: day.toISOString(),
                events: eventsOnDay(day),
                header: (
                  <button
                    type="button"
                    onClick={() => onPickDay(day)}
                    className="flex w-full items-center justify-center gap-1.5 py-1.5 hover:bg-muted/60 transition-colors"
                  >
                    <span className="text-xs font-medium text-muted-foreground">{WEEKDAYS[i]}</span>
                    <span
                      className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
                        sameDay(day, today)
                          ? 'bg-primary font-semibold text-primary-foreground'
                          : 'text-foreground'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </button>
                ),
              }))}
            />
          )
        })()}

      {calView === 'day' &&
        (() => {
          const dayEvents = eventsOnDay(calRef)
          const [startHour, endHour] = hourRange(dayEvents, bounds)
          return (
            <TimeGrid
              startHour={startHour}
              endHour={endHour}
              expandedEvent={expandedEvent}
              onSelect={onSelect}
              columns={[{ key: 'day', events: dayEvents }]}
            />
          )
        })()}

      {selected && (
        <div className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <div className="font-medium text-sm">{selected.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(selected.starts_at).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {selected.location && ` · ${selected.location}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelect(selected.id)}
              aria-label="Close event"
              className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {renderDetail(selected)}
        </div>
      )}
    </div>
  )
}

// ── Month grid ──────────────────────────────────────────────────────────────

function MonthGrid({
  calRef,
  today,
  eventsOnDay,
  onPickDay,
  eventPill,
}: {
  calRef: Date
  today: Date
  eventsOnDay: (date: Date) => EventRow[]
  onPickDay: (date: Date) => void
  eventPill: (event: EventRow) => React.ReactNode
}) {
  const year = calRef.getFullYear()
  const month = calRef.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Leading blanks + day cells, padded to whole weeks
  const cells: Array<number | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="px-1 py-1.5 text-center text-xs font-medium text-muted-foreground"
          >
            {wd}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const date = day ? new Date(year, month, day) : null
          const dayEvents = date ? eventsOnDay(date) : []
          const isToday = date ? sameDay(date, today) : false
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed calendar grid slots
              key={i}
              className={`min-h-[74px] border-b border-r border-border p-1 last-of-type:border-r-0 ${
                day ? '' : 'bg-muted/20'
              }`}
            >
              {day && date && (
                <>
                  <button
                    type="button"
                    onClick={() => onPickDay(date)}
                    aria-label={`View ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`}
                    className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs transition-colors ${
                      isToday
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {day}
                  </button>
                  <div className="space-y-0.5">{dayEvents.map((event) => eventPill(event))}</div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Vertical time grid (day / week views) ────────────────────────────────────

type TimeColumn = { key: string; events: EventRow[]; header?: React.ReactNode }

function TimeGrid({
  startHour,
  endHour,
  columns,
  expandedEvent,
  onSelect,
  minWidthClass,
}: {
  startHour: number
  endHour: number
  columns: TimeColumn[]
  expandedEvent: string | null
  onSelect: (id: string) => void
  minWidthClass?: string
}) {
  const hours = endHour - startHour
  const totalPx = hours * HOUR_PX
  const hourList = Array.from({ length: hours + 1 }, (_, i) => startHour + i)
  const hasHeaders = columns.some((c) => c.header)

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className={minWidthClass ?? ''}>
        {hasHeaders && (
          <div className="flex border-b border-border bg-muted/50">
            <div className="w-14 shrink-0 border-r border-border" />
            {columns.map((col) => (
              <div key={col.key} className="flex-1 border-r border-border last:border-r-0">
                {col.header}
              </div>
            ))}
          </div>
        )}
        <div className="flex">
          {/* Hour labels */}
          <div
            className="relative w-14 shrink-0 border-r border-border"
            style={{ height: totalPx }}
          >
            {hourList.slice(0, -1).map((h) => (
              <div
                key={h}
                className="absolute right-1.5 text-[10px] tabular-nums text-muted-foreground"
                style={{ top: (h - startHour) * HOUR_PX }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>
          {/* Day columns */}
          <div className="flex flex-1">
            {columns.map((col) => {
              const laid = layoutColumn(col.events, startHour)
              return (
                <div
                  key={col.key}
                  className="relative flex-1 border-r border-border last:border-r-0"
                  style={{ height: totalPx }}
                >
                  {hourList.map((h) => (
                    <div
                      key={h}
                      className="pointer-events-none absolute inset-x-0 border-t border-border/50"
                      style={{ top: (h - startHour) * HOUR_PX }}
                    />
                  ))}
                  {laid.map(({ event, topPx, heightPx, lane, cols }) => {
                    const { start, end } = eventBounds(event)
                    const isSelected = expandedEvent === event.id
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => onSelect(event.id)}
                        title={`${event.title} · ${eventTime(start.toISOString())}–${eventTime(end.toISOString())}`}
                        style={{
                          top: topPx,
                          height: heightPx,
                          left: `calc(${(lane / cols) * 100}% + 1px)`,
                          width: `calc(${100 / cols}% - 2px)`,
                        }}
                        className={`absolute overflow-hidden rounded px-1 py-0.5 text-left text-[10px] leading-tight ring-1 transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground ring-primary'
                            : 'bg-primary/10 text-primary ring-primary/20 hover:bg-primary/20'
                        }`}
                      >
                        <span className="block truncate font-medium">{event.title}</span>
                        {heightPx >= 32 && (
                          <span className="block truncate opacity-80">
                            {eventTime(start.toISOString())}–{eventTime(end.toISOString())}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
