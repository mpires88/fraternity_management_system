import { ArrowRight, Building2 } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMyOrganizationsDal } from '@/dal/orgs'
import { isPlatformAdmin } from '@/lib/auth/org-context'
import { createClient, getAuthUser } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const orgs = await getMyOrganizationsDal(supabase, user.id)

  if (orgs.length === 0) {
    const isAdmin = await isPlatformAdmin(supabase)
    if (isAdmin) redirect('/platform-admin')
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground">No chapter access</h1>
          <p className="text-sm text-muted-foreground mt-2">
            You don&apos;t belong to any chapter yet. Contact your chapter admin to get an invite.
          </p>
        </div>
      </div>
    )
  }

  if (orgs.length === 1) {
    const org = orgs[0]
    const basePath = `/${org.parentSlug ?? org.slug}/${org.slug}`
    redirect(org.groups.length === 1 ? `${basePath}/${org.groups[0].slug}/dashboard` : basePath)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-8 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground">Your organizations</h1>
          <p className="text-sm text-muted-foreground mt-2">
            You belong to {orgs.length} organizations. Pick one to continue.
          </p>
        </div>

        <div className="space-y-3">
          {orgs.map((org) => {
            const basePath = `/${org.parentSlug ?? org.slug}/${org.slug}`
            const href =
              org.groups.length === 1 ? `${basePath}/${org.groups[0].slug}/dashboard` : basePath
            return (
              <Link
                key={org.id}
                href={href}
                className="flex items-center justify-between gap-4 rounded-xl bg-card ring-1 ring-foreground/10 hover:ring-brand/40 transition-all px-5 py-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {org.logoUrl ? (
                    // biome-ignore lint/performance/noImgElement: external URL, domain unknown at build time
                    <img
                      src={org.logoUrl}
                      alt=""
                      className="w-10 h-10 rounded-lg object-contain shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center text-brand shrink-0">
                      <Building2 size={18} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{org.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {org.parentName ? `${org.parentName} · ` : ''}
                      {org.groups.map((g) => g.name).join(', ')}
                    </p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-muted-foreground shrink-0" />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
