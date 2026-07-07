'use client'

import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  Vote,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { NotificationBell } from '@/components/layout/notification-bell'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { useOrg } from '@/lib/context/org-context'
import { createClient } from '@/lib/supabase/client'
import { isEnabled } from '@/lib/utils/features'

type NavItem = { label: string; href: string; icon: React.ReactNode }
type NavGroup = { label: string; icon: React.ReactNode; items: NavItem[] }

export function AppSidebar() {
  const { parentOrg, org, group, person, allGroups, switchGroup, permissions } = useOrg()
  const pathname = usePathname()
  const router = useRouter()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const base = parentOrg
    ? `/${parentOrg.slug}/${org.slug}/${group.slug}`
    : `/${org.slug}/${org.slug}/${group.slug}`

  const groups: NavGroup[] = [
    {
      label: 'Members',
      icon: <Users size={16} />,
      items: [
        ...(isEnabled(org, 'members')
          ? [{ label: 'Roster', href: `${base}/members`, icon: <Users size={15} /> }]
          : []),
        ...(isEnabled(org, 'subgroups')
          ? [{ label: 'Subgroups', href: `${base}/subgroups`, icon: <GitBranch size={15} /> }]
          : []),
      ],
    },
  ].filter((g) => g.items.length > 0)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col w-56 shrink-0 bg-sidebar border-r border-sidebar-border h-screen">
      {/* Org header / switcher */}
      <div className="px-4 py-4 border-b border-sidebar-border relative">
        <button
          onClick={() => allGroups.length > 1 && setSwitcherOpen(!switcherOpen)}
          className="flex items-center gap-2 w-full text-left group"
        >
          <div className="w-7 h-7 rounded bg-brand flex items-center justify-center text-brand-foreground text-xs font-bold shrink-0">
            {group.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{group.name}</p>
            <p className="text-xs text-muted-foreground truncate">{parentOrg?.name}</p>
          </div>
          {allGroups.length > 1 && (
            <ChevronDown
              size={14}
              className={`text-muted-foreground shrink-0 transition-transform ${switcherOpen ? 'rotate-180' : ''}`}
            />
          )}
        </button>

        {switcherOpen && (
          <div className="absolute left-2 right-2 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
            {allGroups
              .filter((m) => m.group.id !== org.id)
              .map((m) => (
                <button
                  key={m.group.id}
                  onClick={() => {
                    setSwitcherOpen(false)
                    switchGroup(m.group.slug, m.orgSlug, m.parentSlug ?? undefined)
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-accent transition-colors"
                >
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold shrink-0">
                    {m.group.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{m.group.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.group.group_type ?? 'group'}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {/* Dashboard (top-level) */}
        <NavLink
          href={`${base}/dashboard`}
          icon={<LayoutDashboard size={16} />}
          label="Dashboard"
          pathname={pathname}
        />

        <NavLink
          href={`${base}/requirements`}
          icon={<ClipboardCheck size={16} />}
          label="Requirements"
          pathname={pathname}
        />

        <NavLink
          href={`${base}/polls`}
          icon={<Vote size={16} />}
          label="Polls"
          pathname={pathname}
        />

        <NavLink
          href={`${base}/documents`}
          icon={<FileText size={16} />}
          label="Documents"
          pathname={pathname}
        />

        {/* Grouped sections */}
        {groups.map((group) => (
          <NavSection key={group.label} group={group} pathname={pathname} />
        ))}

        {/* Admin (full access only) */}
        {permissions.access_level === 'full' && (
          <div className="mt-3 pt-3 border-t border-sidebar-border">
            <NavLink
              href={`${base}/admin`}
              icon={<Settings size={16} />}
              label="Settings"
              pathname={pathname}
            />
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="px-4 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
            {person.full_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {person.full_name}
            </p>
          </div>
          <NotificationBell />
        </div>
        <ThemeToggle />
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

function NavLink({
  href,
  icon,
  label,
  pathname,
  nested = false,
}: {
  href: string
  icon: React.ReactNode
  label: string
  pathname: string
  nested?: boolean
}) {
  const active = pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
        active
          ? 'bg-brand/10 text-brand font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      } ${nested ? 'pl-9' : ''}`}
    >
      {!nested && icon}
      {label}
    </Link>
  )
}

function NavSection({ group, pathname }: { group: NavGroup; pathname: string }) {
  const hasActive = group.items.some((item) => pathname.startsWith(item.href))
  const [open, setOpen] = useState(hasActive)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2.5 w-full px-3 py-1.5 rounded-md text-sm transition-colors ${
          hasActive && !open
            ? 'text-brand font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        {group.icon}
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronRight size={13} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              pathname={pathname}
              nested
            />
          ))}
        </div>
      )}
    </div>
  )
}
