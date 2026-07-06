'use client'

import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { MemberAvatar } from '@/components/shared/member-avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { MemberRow } from '@/dal/members'

type SortKey = 'name' | 'number' | 'role' | 'status' | 'email'
type SortDir = 'asc' | 'desc'

export function MembersTable({
  members,
  parentSlug,
  orgSlug,
}: {
  members: MemberRow[]
  parentSlug: string
  orgSlug: string
}) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return members
    return members.filter(
      (m) =>
        m.person.full_name.toLowerCase().includes(q) ||
        m.person.nickname?.toLowerCase().includes(q) ||
        m.person.member_number?.toLowerCase().includes(q) ||
        m.person.school_email.toLowerCase().includes(q) ||
        m.role_type.name.toLowerCase().includes(q) ||
        m.status_definition.name.toLowerCase().includes(q)
    )
  }, [members, search])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sortKey) {
        case 'name':
          av = a.person.full_name.toLowerCase()
          bv = b.person.full_name.toLowerCase()
          break
        case 'number':
          av = parseInt(a.person.member_number ?? '0', 10) || 0
          bv = parseInt(b.person.member_number ?? '0', 10) || 0
          break
        case 'role':
          av = a.role_type.name.toLowerCase()
          bv = b.role_type.name.toLowerCase()
          break
        case 'status':
          av = a.status_definition.name.toLowerCase()
          bv = b.status_definition.name.toLowerCase()
          break
        case 'email':
          av = (a.chapter_email ?? a.person.school_email).toLowerCase()
          bv = (b.chapter_email ?? b.person.school_email).toLowerCase()
          break
      }
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [filtered, sortKey, sortDir])

  return (
    <div>
      <div className="relative mb-4">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          placeholder="Search by name, nickname, badge #, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {sorted.length} result{sorted.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {search ? 'No members match your search.' : 'No members yet.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <SortHeader
                  label="Name"
                  sortKey="name"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="#"
                  sortKey="number"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="w-20"
                />
                <SortHeader
                  label="Role"
                  sortKey="role"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Status"
                  sortKey="status"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Email"
                  sortKey="email"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sorted.map((m) => (
                <tr key={m.id} className="hover:bg-accent/50 transition-colors group">
                  <td className="px-4 py-3">
                    <Link
                      href={`/${parentSlug}/${orgSlug}/members/${m.person_id}`}
                      className="flex items-center gap-3"
                    >
                      <MemberAvatar
                        src={m.person.profile_photo}
                        fullName={m.person.full_name}
                        firstName={m.person.first_name}
                        lastName={m.person.last_name}
                        size="sm"
                      />
                      <div>
                        <p className="font-medium text-foreground group-hover:text-brand transition-colors">
                          {m.person.full_name}
                        </p>
                        {m.person.nickname && (
                          <p className="text-xs text-muted-foreground">
                            &ldquo;{m.person.nickname}&rdquo;
                          </p>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {m.person.member_number ? `#${m.person.member_number}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: m.role_type.color ?? 'var(--brand)' }}
                      />
                      {m.role_type.name}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={
                        m.status_definition.color
                          ? {
                              borderColor: m.status_definition.color,
                              color: m.status_definition.color,
                            }
                          : undefined
                      }
                    >
                      {m.status_definition.name}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {m.chapter_email ?? m.person.school_email}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className = '',
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  className?: string
}) {
  const isActive = current === sortKey
  return (
    <th className={`text-left px-4 py-3 ${className}`}>
      <button
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
      >
        {label}
        {isActive ? (
          dir === 'asc' ? (
            <ArrowUp size={12} />
          ) : (
            <ArrowDown size={12} />
          )
        ) : (
          <ArrowUpDown size={12} className="opacity-30" />
        )}
      </button>
    </th>
  )
}
