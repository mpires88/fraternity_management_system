import { Calendar, CheckCircle2, ClipboardCheck, FileText, Vote } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { getDashboardData, getMyOpenPollsDal } from '@/dal/dashboard'
import { getDocumentsForGroup } from '@/dal/documents'
import { getGroupContext } from '@/dal/group-context'
import { getMyAssignments } from '@/dal/requirements'
import { createClient, getAuthUser } from '@/lib/supabase/server'

const DOC_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  archived: 'Archived',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

type AttentionItem = {
  key: string
  title: string
  sub: string
  href: string
  tone: 'destructive' | 'warning' | 'brand' | 'info'
  icon: 'requirement' | 'poll'
  chip?: string
  cta?: string
}

const TONE_STYLES: Record<AttentionItem['tone'], { stripe: string; iconBox: string }> = {
  destructive: { stripe: 'bg-destructive', iconBox: 'bg-destructive/10 text-destructive' },
  warning: { stripe: 'bg-warning', iconBox: 'bg-warning/15 text-warning' },
  brand: { stripe: 'bg-brand', iconBox: 'bg-brand/10 text-brand' },
  info: { stripe: 'bg-info', iconBox: 'bg-info/10 text-info' },
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ parent: string; org: string; group: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug } = await params
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')

  const { org, person } = ctx
  const primaryRole = ctx.roles[0]
  const base = `/${parentSlug}/${orgSlug}/${groupSlug}`
  const dash = await getDashboardData(supabase, ctx.group.id)

  const [assignments, openPolls, documents] = await Promise.all([
    dash.currentTerm
      ? getMyAssignments(supabase, person.id, dash.currentTerm.id)
      : Promise.resolve([]),
    getMyOpenPollsDal(supabase, ctx.group.id, person.id),
    getDocumentsForGroup(supabase, ctx.group.id),
  ])

  const completedCount = assignments.filter(
    (a) => a.status === 'complete' || a.status === 'waived'
  ).length
  const pending = assignments
    .filter((a) => a.status !== 'complete' && a.status !== 'waived')
    .sort((a, b) => (a.requirement.due_at ?? '9999').localeCompare(b.requirement.due_at ?? '9999'))
  const nextDue = pending.find((a) => a.requirement.due_at)

  // Term progress (percent elapsed, clamped)
  let termPct: number | null = null
  if (dash.currentTerm) {
    const start = new Date(dash.currentTerm.starts_on).getTime()
    const end = new Date(dash.currentTerm.ends_on).getTime()
    if (end > start) {
      termPct = Math.min(100, Math.max(0, Math.round(((Date.now() - start) / (end - start)) * 100)))
    }
  }

  // "Needs your attention" — pending requirements first (soonest due), then open polls
  const attention: AttentionItem[] = []
  for (const a of pending.slice(0, 3)) {
    const r = a.requirement
    const days = r.due_at ? daysUntil(r.due_at) : null
    const detail = r.quota_target
      ? `${a.progress} of ${r.quota_target} ${r.quota_unit ?? 'units'} logged`
      : (r.kind.charAt(0).toUpperCase() + r.kind.slice(1)).replace(/_/g, ' ')
    attention.push({
      key: `req-${a.id}`,
      title: r.title,
      sub: `${detail} · requirement`,
      href: `${base}/requirements/${r.id}`,
      tone:
        days !== null && days < 0
          ? 'destructive'
          : days !== null && days <= 7
            ? 'warning'
            : 'brand',
      icon: 'requirement',
      chip: r.due_at
        ? days !== null && days < 0
          ? `Overdue · ${fmtDate(r.due_at)}`
          : `Due ${fmtDate(r.due_at)}`
        : undefined,
    })
  }
  for (const p of openPolls) {
    attention.push({
      key: `poll-${p.id}`,
      title: p.title,
      sub: p.closes_at ? `Poll closes ${fmtDate(p.closes_at)}` : 'Open poll',
      href: `${base}/polls`,
      tone: 'info',
      icon: 'poll',
      cta: 'Vote',
    })
  }
  const attentionItems = attention.slice(0, 5)

  const currentMemberTotal =
    dash.memberCounts.active + dash.memberCounts.candidate + dash.memberCounts.away
  const memberSegments = [
    { label: 'Active', count: dash.memberCounts.active, color: 'bg-success' },
    { label: 'Candidates', count: dash.memberCounts.candidate, color: 'bg-info' },
    { label: 'Away', count: dash.memberCounts.away, color: 'bg-muted-foreground' },
  ]

  const recentDocuments = documents.slice(0, 3)

  // Requirements ring: r=15.5 → circumference ≈ 97.39
  const ringCircumference = 2 * Math.PI * 15.5
  const ringFilled =
    assignments.length > 0 ? (completedCount / assignments.length) * ringCircumference : 0

  return (
    <div className="p-8">
      <PageHeader
        title={org.name}
        description={`Welcome back, ${person.nickname ?? person.full_name.split(' ')[0]}`}
        info="Your group home: requirements progress, items that need action from you, and a snapshot of the roster."
      >
        {primaryRole && (
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
        )}
        {dash.currentTerm && (
          <Badge variant="outline" className="gap-1.5 px-2.5 py-1">
            <Calendar size={12} />
            {dash.currentTerm.name}
          </Badge>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        {/* Main column: requirements hero → needs your attention */}
        <div className="space-y-5 min-w-0">
          {/* Hero: requirements ring + term progress */}
          <Card>
            <CardContent className="pt-0">
              <div className="flex items-center gap-7">
                {assignments.length > 0 && (
                  <Link
                    href={`${base}/requirements`}
                    className="relative w-[104px] h-[104px] shrink-0"
                  >
                    <svg
                      width="104"
                      height="104"
                      viewBox="0 0 36 36"
                      className="-rotate-90"
                      role="img"
                      aria-label={`${completedCount} of ${assignments.length} requirements complete`}
                    >
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        strokeWidth="3.2"
                        className="stroke-muted"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeDasharray={`${ringFilled} ${ringCircumference}`}
                        className="stroke-brand"
                      />
                    </svg>
                    <span className="absolute inset-0 grid place-items-center text-center">
                      <span>
                        <span className="block text-lg font-semibold tabular-nums leading-tight">
                          {completedCount}/{assignments.length}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                          Complete
                        </span>
                      </span>
                    </span>
                  </Link>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-foreground">Your requirements</p>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-4">
                    {nextDue
                      ? `Next due ${fmtDate(nextDue.requirement.due_at as string)} — ${nextDue.requirement.title}`
                      : pending.length > 0
                        ? `${pending.length} remaining (no due date)`
                        : assignments.length > 0
                          ? 'All requirements complete — nice work'
                          : 'No requirements assigned this term'}
                  </p>
                  {dash.currentTerm && termPct !== null && (
                    <>
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Term progress
                      </p>
                      <div className="relative h-1.5 rounded-full bg-muted">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-brand/35"
                          style={{ width: `${termPct}%` }}
                        />
                        <div
                          className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground"
                          style={{ left: `${termPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums mt-1.5">
                        <span>{fmtDate(dash.currentTerm.starts_on)}</span>
                        <span>{fmtDate(dash.currentTerm.ends_on)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Needs your attention */}
          <div>
            <div className="flex items-baseline gap-2 mb-2.5 px-0.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                Needs your attention
              </p>
              {attentionItems.length > 0 && (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {attentionItems.length} {attentionItems.length === 1 ? 'item' : 'items'}
                </span>
              )}
            </div>
            <Card>
              <CardContent className="pt-0 divide-y divide-border">
                {attentionItems.length === 0 && (
                  <div className="flex items-center gap-3 py-4">
                    <CheckCircle2 size={18} className="text-success shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      You&apos;re all caught up — nothing needs action right now.
                    </p>
                  </div>
                )}
                {attentionItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="flex items-center gap-3.5 py-3 first:pt-1 last:pb-1 group"
                  >
                    <span
                      className={`w-[3px] self-stretch rounded-full shrink-0 ${TONE_STYLES[item.tone].stripe}`}
                    />
                    <span
                      className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${TONE_STYLES[item.tone].iconBox}`}
                    >
                      {item.icon === 'requirement' ? (
                        <ClipboardCheck size={16} />
                      ) : (
                        <Vote size={16} />
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] font-semibold text-foreground truncate group-hover:text-brand transition-colors">
                        {item.title}
                      </span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {item.sub}
                      </span>
                    </span>
                    {item.chip && (
                      <span
                        className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap tabular-nums ${
                          item.tone === 'destructive'
                            ? 'bg-destructive/10 text-destructive'
                            : item.tone === 'warning'
                              ? 'bg-warning/15 text-foreground'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {item.chip}
                      </span>
                    )}
                    {item.cta && (
                      <span className="text-xs font-medium text-brand border border-border rounded-md px-3 py-1.5 whitespace-nowrap">
                        {item.cta}
                      </span>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rail: membership + recent documents */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-foreground">Membership</p>
                <Link
                  href={`${base}/members`}
                  className="text-[11.5px] font-medium text-brand hover:underline"
                >
                  Roster →
                </Link>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-semibold tabular-nums">{currentMemberTotal}</span>
                <span className="text-xs text-muted-foreground">current members</span>
              </div>
              {currentMemberTotal > 0 && (
                <div
                  className="flex gap-0.5 h-2.5 rounded-full overflow-hidden mb-3"
                  role="img"
                  aria-label={memberSegments
                    .map((s) => `${s.count} ${s.label.toLowerCase()}`)
                    .join(', ')}
                >
                  {memberSegments
                    .filter((s) => s.count > 0)
                    .map((s) => (
                      <div key={s.label} className={s.color} style={{ flexGrow: s.count }} />
                    ))}
                </div>
              )}
              <div className="space-y-1.5">
                {memberSegments.map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className={`w-2 h-2 rounded-[3px] ${s.color}`} />
                      {s.label}
                    </span>
                    <span className="font-semibold tabular-nums">{s.count}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border mt-3 pt-2.5 text-xs">
                <span className="text-muted-foreground">
                  +{' '}
                  <span className="font-semibold text-foreground tabular-nums">
                    {dash.memberCounts.alumni}
                  </span>{' '}
                  alumni
                </span>
                {dash.currentOfficers.length > 0 && (
                  <span className="text-muted-foreground tabular-nums">
                    {dash.currentOfficers.length} officers
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {dash.currentOfficers.length > 0 && (
            <Card>
              <CardContent className="pt-0">
                <p className="text-xs font-semibold text-foreground mb-1">Current officers</p>
                <div className="divide-y divide-border">
                  {dash.currentOfficers.slice(0, 6).map((o) => (
                    <Link
                      key={`${o.person_id}-${o.position_title}`}
                      href={`${base}/members/${o.person_id}`}
                      className="flex items-center justify-between gap-2 py-2 group"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-brand/10 grid place-items-center text-[11px] font-medium text-brand shrink-0">
                          {o.person_name.charAt(0)}
                        </span>
                        <span className="text-[12.5px] text-foreground truncate group-hover:text-brand transition-colors">
                          {o.person_name}
                        </span>
                      </span>
                      <span className="text-[11.5px] text-muted-foreground shrink-0">
                        {o.position_title}
                      </span>
                    </Link>
                  ))}
                </div>
                {dash.currentOfficers.length > 6 && (
                  <Link
                    href={`${base}/members`}
                    className="block text-[11.5px] font-medium text-brand hover:underline pt-2"
                  >
                    All {dash.currentOfficers.length} officers →
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {recentDocuments.length > 0 && (
            <Card>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground">Recent documents</p>
                  <Link
                    href={`${base}/documents`}
                    className="text-[11.5px] font-medium text-brand hover:underline"
                  >
                    All →
                  </Link>
                </div>
                <div className="divide-y divide-border">
                  {recentDocuments.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`${base}/documents/${doc.id}`}
                      className="flex items-center gap-2.5 py-2.5 group"
                    >
                      <FileText size={14} className="text-muted-foreground shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[12.5px] font-medium text-foreground truncate group-hover:text-brand transition-colors">
                          {doc.title}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {DOC_STATUS_LABELS[doc.status] ?? doc.status} · {fmtDate(doc.created_at)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
