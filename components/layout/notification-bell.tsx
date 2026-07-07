'use client'

import { Bell, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  getNotifications,
  markAllNotificationsRead,
  markRead,
} from '@/actions/notifications.action'

type Notification = {
  id: string
  type: string
  group_key: string | null
  title: string
  body: string | null
  href: string | null
  read_at: string | null
  created_at: string
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isPending, startTransition] = useTransition()

  const unreadCount = notifications.filter((n) => !n.read_at).length

  const fetchNotifications = useCallback(() => {
    startTransition(async () => {
      const result = await getNotifications()
      if (result.success && result.data) {
        setNotifications(result.data)
      }
    })
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await markRead({ notificationId: id })
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: 'now' } : n)))
    })
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? 'now' })))
    })
  }

  // Collapse by group_key
  const collapsed = collapseNotifications(notifications)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors"
        title="Notifications"
      >
        <Bell size={16} className="text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-brand text-brand-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 bottom-full mb-2 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={isPending}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {collapsed.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                  No notifications
                </p>
              )}
              {collapsed.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={() => handleMarkRead(n.id)}
                  onClose={() => setOpen(false)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

type CollapsedNotification = Notification & { count: number }

function collapseNotifications(notifications: Notification[]): CollapsedNotification[] {
  const seen = new Map<string, CollapsedNotification>()
  const result: CollapsedNotification[] = []

  for (const n of notifications) {
    const key = n.group_key
    if (key && seen.has(key)) {
      const existing = seen.get(key) as CollapsedNotification
      existing.count++
      if (!n.read_at && existing.read_at) {
        existing.read_at = null
      }
    } else {
      const collapsed = { ...n, count: 1 }
      if (key) seen.set(key, collapsed)
      result.push(collapsed)
    }
  }

  return result
}

function NotificationItem({
  notification: n,
  onRead,
  onClose,
}: {
  notification: CollapsedNotification
  onRead: () => void
  onClose: () => void
}) {
  const isUnread = !n.read_at
  const inner = (
    <div
      className={`px-4 py-2.5 border-b border-border last:border-0 transition-colors ${
        isUnread ? 'bg-brand/5' : ''
      } hover:bg-accent cursor-pointer`}
      onClick={() => {
        if (isUnread) onRead()
        onClose()
      }}
    >
      <div className="flex items-start gap-2">
        {isUnread && <span className="mt-1.5 w-2 h-2 rounded-full bg-brand shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-snug">
            {n.title}
            {n.count > 1 && <span className="text-muted-foreground"> (+{n.count - 1} more)</span>}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
        </div>
      </div>
    </div>
  )

  if (n.href) return <Link href={n.href}>{inner}</Link>
  return inner
}
