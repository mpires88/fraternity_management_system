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
  upsertNotificationPrefs,
} from '@/dal/notifications'

type MarkReadInput = { notificationId: string }

export const markRead = createAuthenticatedAction<MarkReadInput, void>(
  async (supabase, _user, input) => {
    await markNotificationRead(supabase, input.notificationId)
  }
)

export const markAllNotificationsRead = createNoInputAuthenticatedAction<void>(
  async (supabase, user) => {
    await markAllRead(supabase, user.id)
  }
)

export const getNotifications = createNoInputQueryAction<NotificationRow[]>(
  async (supabase, user) => {
    return getRecentNotifications(supabase, user.id)
  }
)

export const getPreferences = createNoInputQueryAction<NotificationPrefs>(
  async (supabase, user) => {
    return getNotificationPrefs(supabase, user.id)
  }
)

export const updatePreferences = createAuthenticatedAction<NotificationPrefs, void>(
  async (supabase, user, input) => {
    await upsertNotificationPrefs(supabase, user.id, input)
  }
)
