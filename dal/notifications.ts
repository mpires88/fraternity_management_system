import type { DbClient } from '@/dal/types'

export type NotificationRow = {
  id: string
  type: string
  group_key: string | null
  title: string
  body: string | null
  href: string | null
  read_at: string | null
  created_at: string
}

export async function getUnreadNotifications(
  supabase: DbClient,
  personId: string,
  limit = 20
): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from('notifications')
    .select('id, type, group_key, title, body, href, read_at, created_at')
    .eq('person_id', personId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as NotificationRow[]
}

export async function getRecentNotifications(
  supabase: DbClient,
  personId: string,
  limit = 30
): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from('notifications')
    .select('id, type, group_key, title, body, href, read_at, created_at')
    .eq('person_id', personId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as NotificationRow[]
}

export async function getUnreadCount(supabase: DbClient, personId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', personId)
    .is('read_at', null)

  return count ?? 0
}

export async function markNotificationRead(supabase: DbClient, notificationId: string) {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
}

export async function markAllRead(supabase: DbClient, personId: string) {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('person_id', personId)
    .is('read_at', null)
}
