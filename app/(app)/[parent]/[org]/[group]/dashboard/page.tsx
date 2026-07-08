import { Calendar, ClipboardCheck, GraduationCap, UserPlus, Users, UserX } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { getDashboardData } from '@/dal/dashboard'
import { getGroupContext } from '@/dal/group-context'
import { getMyAssignments } from '@/dal/requirements'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ parent: string; org: string; group: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')

  const { org, person, roles } = ctx
  const primaryRole = roles[0]
  const base = `/${parentSlug}/${orgSlug}/${groupSlug}`
  const dash = await getDashboardData(supabase, ctx.group.id)

  const assignments = dash.currentTerm
    ? await getMyAssignments(supabase, person.id, dash.currentTerm.id)
    : []
  const completedCount = assignments.filter(
    (a) => a.status === 'complete' || a.status === 'waived'
  ).length
  const pending = assignments
    .filter((a) => a.status !== 'complete' && a.status !== 'waived')
    .sort((a, b) => {
      const da = a.requirement.due_at ?? ''
      const db = b.requirement.due_at ?? ''
      return da.localeCompare(db)
    })
  const nextDue = pending.find((a) => a.requirement.due_at)

  return (
    <div className="p-8">
      <PageHeader
        title={org.name}
        description={`Welcome back, ${person.nickname ?? person.full_name.split(' ')[0]}`}
        info="Your chapter dashboard shows membership stats, upcoming requirements, and current officers at a glance."
      />

      {/* Your badge + current term */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <Badge variant="secondary" className="gap-1.5 px-2.5 py-1">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: primaryRole.roleType.color ?? 'var(--brand)' }}
          />
          {primaryRole.roleType.name}
          {primaryRole.statusDefinition.slug !== 'active' && (
            <span className="text-muted-foreground capitalize">
              · {primaryRole.statusDefinition.name}
            </span>
          )}
        </Badge>
        {dash.currentTerm && (
          <Badge variant="outline" className="gap-1.5 px-2.5 py-1">
            <Calendar size={12} />
            {dash.currentTerm.name}
          </Badge>
        )}
      </div>

      {/* Member counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Users size={16} className="text-success" />}
          label="Active"
          value={dash.memberCounts.active}
          href={`${base}/members`}
        />
        <StatCard
          icon={<UserPlus size={16} className="text-info" />}
          label="Candidates"
          value={dash.memberCounts.candidate}
          href={`${base}/members`}
        />
        <StatCard
          icon={<UserX size={16} className="text-muted-foreground" />}
          label="Away"
          value={dash.memberCounts.away}
          href={`${base}/members`}
        />
        <StatCard
          icon={<GraduationCap size={16} className="text-brand" />}
          label="Alumni"
          value={dash.memberCounts.alumni}
          href={`${base}/members`}
        />
      </div>

      {/* Requirements summary */}
      {assignments.length > 0 && (
        <Link href={`${base}/requirements`} className="block mb-8">
          <Card className="hover:ring-brand/30 transition-all cursor-pointer">
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClipboardCheck size={18} className="text-brand" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {completedCount} of {assignments.length} requirements complete
                    </p>
                    {nextDue && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Next due:{' '}
                        {new Date(nextDue.requirement.due_at as string).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                          }
                        )}{' '}
                        — {nextDue.requirement.title}
                      </p>
                    )}
                    {!nextDue && pending.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pending.length} remaining (no due date)
                      </p>
                    )}
                  </div>
                </div>
                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all"
                    style={{
                      width: `${(completedCount / assignments.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Current officers */}
      {dash.currentOfficers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Current Officers</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border -mt-2">
            {dash.currentOfficers.map((o) => (
              <Link
                key={`${o.person_id}-${o.position_title}`}
                href={`${base}/members/${o.person_id}`}
                className="flex items-center justify-between py-3 hover:bg-accent/50 -mx-4 px-4 rounded transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center text-xs font-medium text-brand">
                    {o.person_name.charAt(0)}
                  </div>
                  <span className="text-sm text-foreground">{o.person_name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{o.position_title}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: number
  href: string
}) {
  return (
    <Link href={href}>
      <Card className="hover:ring-brand/30 transition-all cursor-pointer">
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 mb-1">
            {icon}
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </p>
          </div>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </CardContent>
      </Card>
    </Link>
  )
}
