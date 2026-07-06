'use client'

import { useEffect } from 'react'
import { setOrgCookie } from '@/actions/auth/set-org-cookie'

/**
 * Silently sets the currentOrgId cookie when a user enters an org context.
 * Rendered by the [org] layout — fires once per org navigation.
 */
export function SetOrgCookie({ groupId }: { groupId: string }) {
  useEffect(() => {
    setOrgCookie(groupId)
  }, [groupId])

  return null
}
