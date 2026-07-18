'use server'

import {
  createAuthenticatedAction,
  createNoInputAuthenticatedAction,
  createNoInputQueryAction,
} from '@/actions/utils/action-helpers'
import type { NotificationPrefs, NotificationRow } from '@/dal/notifications'
import {
  getNotificationPrefs,
  getRecentNotifications,
  markAllRead,
  markNotificationRead,
  regenerateCalendarToken,
  upsertNotificationPrefs,
} from '@/dal/notifications'

type MarkReadInput = { notificationId: string }

export const markRead = createAuthenticatedAction<MarkReadInput, void>(
  async (supabase, _actor, input) => {
    await markNotificationRead(supabase, input.notificationId)
  }
)

export const markAllNotificationsRead = createNoInputAuthenticatedAction<void>(
  async (supabase, actor) => {
    await markAllRead(supabase, actor.personId)
  }
)

export const getNotifications = createNoInputQueryAction<NotificationRow[]>(
  async (supabase, actor) => {
    return getRecentNotifications(supabase, actor.personId)
  }
)

export const getPreferences = createNoInputQueryAction<NotificationPrefs>(
  async (supabase, actor) => {
    return getNotificationPrefs(supabase, actor.personId)
  }
)

export const updatePreferences = createAuthenticatedAction<NotificationPrefs, void>(
  async (supabase, actor, input) => {
    await upsertNotificationPrefs(supabase, actor.personId, input)
  }
)

export const regenerateFeedToken = createNoInputAuthenticatedAction<string>(
  async (supabase, actor) => {
    return regenerateCalendarToken(supabase, actor.personId)
  }
)
