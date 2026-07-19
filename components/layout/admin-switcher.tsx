'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getOrgSwitcherData, type OrgSwitcherOrg } from '@/actions/platform-admin.action'

type ViewAs = '' | 'officer' | 'member'

function readViewAsCookie(): ViewAs {
  const match = document.cookie.match(/(?:^|;\s*)viewAs=([^;]*)/)
  const value = match?.[1] ?? ''
  return value === 'officer' || value === 'member' ? value : ''
}

/**
 * Platform-admin control strip: jump to any organization or group, and
 * preview the UI as an officer or plain member. Preview affects what the UI
 * shows — RLS still governs the data underneath.
 */
export function AdminSwitcher() {
  const router = useRouter()
  const params = useParams<{ parent: string; org: string; group: string }>()
  const [orgs, setOrgs] = useState<OrgSwitcherOrg[]>([])
  const [viewAs, setViewAs] = useState<ViewAs>('')

  useEffect(() => {
    getOrgSwitcherData().then((result) => {
      if (result.success && result.data) setOrgs(result.data)
    })
    setViewAs(readViewAsCookie())
  }, [])

  const currentOrg = orgs.find((o) => o.slug === params.org)

  function go(org: OrgSwitcherOrg, groupSlug?: string) {
    const target = groupSlug ?? org.groups[0]?.slug
    if (!target) return
    router.push(`/${org.parentSlug ?? org.slug}/${org.slug}/${target}/dashboard`)
  }

  function changeViewAs(next: ViewAs) {
    setViewAs(next)
    if (next) {
      document.cookie = `viewAs=${next}; path=/; max-age=86400`
    } else {
      document.cookie = 'viewAs=; path=/; max-age=0'
    }
    router.refresh()
  }

  if (orgs.length === 0) return null

  return (
    <div className="px-3 py-2 border-b border-sidebar-border bg-brand/5 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-brand px-1">
        Platform Admin
      </p>

      <label className="block">
        <span className="sr-only">Organization</span>
        <select
          value={currentOrg?.slug ?? ''}
          onChange={(e) => {
            const org = orgs.find((o) => o.slug === e.target.value)
            if (org) go(org)
          }}
          className="w-full text-xs bg-background border border-border rounded-md px-2 py-1 text-foreground"
        >
          {!currentOrg && <option value="">Jump to organization…</option>}
          {orgs.map((o) => (
            <option key={o.id} value={o.slug}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      {currentOrg && (
        <label className="block">
          <span className="sr-only">Group</span>
          <select
            value={params.group ?? ''}
            onChange={(e) => go(currentOrg, e.target.value)}
            className="w-full text-xs bg-background border border-border rounded-md px-2 py-1 text-foreground"
          >
            {currentOrg.groups.map((g) => (
              <option key={g.id} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="sr-only">View as</span>
        <select
          value={viewAs}
          onChange={(e) => changeViewAs(e.target.value as ViewAs)}
          className="w-full text-xs bg-background border border-border rounded-md px-2 py-1 text-foreground"
        >
          <option value="">View as: yourself</option>
          <option value="officer">View as: officer</option>
          <option value="member">View as: member</option>
        </select>
      </label>
    </div>
  )
}
