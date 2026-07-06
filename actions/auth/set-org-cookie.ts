'use server'

import { cookies } from 'next/headers'

/**
 * Sets the currentOrgId cookie so server actions can inject it as the
 * x-org-id header for RLS scoping.
 *
 * Called client-side by SetOrgCookie component after the layout resolves
 * the org from the URL. Safe to call on every navigation.
 */
export async function setOrgCookie(groupId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('currentOrgId', groupId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
}
