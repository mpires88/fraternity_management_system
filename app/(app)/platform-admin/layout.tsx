import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isPlatformAdmin } from '@/lib/auth/org-context'
import { createClient } from '@/lib/supabase/server'

const NAV_ITEMS = [
  { label: 'Overview', href: '/platform-admin' },
  { label: 'National Organizations', href: '/platform-admin/national-orgs' },
  { label: 'Chapters', href: '/platform-admin/chapters' },
  { label: 'Admins', href: '/platform-admin/admins' },
]

export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const isAdmin = await isPlatformAdmin(supabase)
  if (!isAdmin) redirect('/')

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="px-4 py-4 border-b border-sidebar-border">
          <p className="text-sm font-semibold text-sidebar-foreground">Platform Admin</p>
          <p className="text-xs text-muted-foreground">Super user controls</p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-sidebar-border">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to app
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-background p-8">{children}</main>
    </div>
  )
}
