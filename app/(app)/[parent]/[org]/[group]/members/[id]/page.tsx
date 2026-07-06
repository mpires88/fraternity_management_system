import {
  ArrowLeft,
  GitBranch,
  GraduationCap,
  Hash,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { EditMemberButton } from '@/components/members/edit-member-button'
import { FamilyTree } from '@/components/members/family-tree'
import { MemberAvatar } from '@/components/shared/member-avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getGroupContext } from '@/dal/group-context'
import { getPersonProfile } from '@/dal/person-profile'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissionsFromContext } from '@/lib/utils/resolve-permissions'

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ parent: string; org: string; group: string; id: string }>
}) {
  const { parent: parentSlug, org: orgSlug, group: groupSlug, id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getGroupContext(supabase, { parentSlug, orgSlug, groupSlug }, user.id)
  if (!ctx) redirect('/login')
  const perms = resolvePermissionsFromContext(ctx)
  if (!perms.can_view_roster) notFound()

  const profile = await getPersonProfile(supabase, id, ctx.org.id)
  if (!profile) notFound()

  const [{ data: roleTypes }, { data: statusDefs }] = await Promise.all([
    supabase
      .from('role_types')
      .select('id, name, slug')
      .eq('group_id', ctx.org.id)
      .order('display_order'),
    supabase
      .from('status_definitions')
      .select('id, name, slug, is_base')
      .or(`org_id.eq.${ctx.org.id},org_id.is.null`)
      .order('display_order'),
  ])

  const base = `/${parentSlug}/${orgSlug}/${groupSlug}`
  const canEdit = id === user.id || perms.access_level === 'full'

  const formalName =
    [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ') ||
    profile.full_name

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href={`${base}/members`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Members
      </Link>

      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        <MemberAvatar
          src={profile.profile_photo}
          fullName={profile.full_name}
          firstName={profile.first_name}
          lastName={profile.last_name}
          size="xl"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{profile.full_name}</h1>
            {canEdit && (
              <EditMemberButton
                profile={profile}
                roleTypes={(roleTypes ?? []) as { id: string; name: string; slug: string }[]}
                statusDefinitions={
                  (statusDefs ?? []) as {
                    id: string
                    name: string
                    slug: string
                    is_base: boolean
                  }[]
                }
              />
            )}
          </div>
          {/* Subtitle: preferred name / nickname */}
          {(profile.preferred_name || profile.nickname) && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {profile.preferred_name && profile.preferred_name !== profile.first_name && (
                <span>Goes by {profile.preferred_name}</span>
              )}
              {profile.preferred_name && profile.nickname && <span> · </span>}
              {profile.nickname && <span>&ldquo;{profile.nickname}&rdquo;</span>}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: profile.membership.role_type?.color ?? 'var(--brand)' }}
              />
              {profile.membership.role_type?.name}
            </Badge>
            {profile.membership.status_definition?.slug !== 'active' && (
              <Badge
                variant="outline"
                className="text-xs"
                style={
                  profile.membership.status_definition?.color
                    ? {
                        borderColor: profile.membership.status_definition.color,
                        color: profile.membership.status_definition.color,
                      }
                    : undefined
                }
              >
                {profile.membership.status_definition?.name}
              </Badge>
            )}
            {profile.member_number && <Badge variant="outline">#{profile.member_number}</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact info */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow icon={<User size={15} />} label="Full name" value={formalName} />
                {profile.preferred_name && (
                  <InfoRow
                    icon={<User size={15} />}
                    label="Preferred name"
                    value={profile.preferred_name}
                  />
                )}
                <InfoRow
                  icon={<Mail size={15} />}
                  label="School email"
                  value={profile.school_email}
                />
                {profile.personal_email && profile.personal_email !== profile.school_email && (
                  <InfoRow
                    icon={<Mail size={15} />}
                    label="Personal email"
                    value={profile.personal_email}
                  />
                )}
                {profile.phone && (
                  <InfoRow
                    icon={<Phone size={15} />}
                    label="Phone"
                    value={formatPhone(profile.phone)}
                  />
                )}
              </div>
              {/* Address */}
              {(profile.street_address || profile.city || profile.state || profile.country) && (
                <div className="mt-4 pt-4 border-t border-border">
                  <InfoRow
                    icon={<MapPin size={15} />}
                    label="Address"
                    value={formatAddress(
                      profile.street_address,
                      profile.city,
                      profile.state,
                      profile.country
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Emergency contact */}
          {profile.emergency_contact && (
            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Link
                    href={`${base}/members/${profile.emergency_contact.id}`}
                    className="flex items-center gap-3 hover:text-brand transition-colors"
                  >
                    <MemberAvatar fullName={profile.emergency_contact.full_name} size="md" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {profile.emergency_contact.full_name}
                      </p>
                      {profile.emergency_contact.phone && (
                        <p className="text-xs text-muted-foreground">
                          {formatPhone(profile.emergency_contact.phone)}
                        </p>
                      )}
                    </div>
                  </Link>
                  {profile.emergency_contact.relationship && (
                    <Badge variant="outline" className="capitalize text-xs">
                      {profile.emergency_contact.relationship.replace('_', '/')}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chapter details */}
          <Card>
            <CardHeader>
              <CardTitle>Chapter Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.expected_grad_year && (
                  <InfoRow
                    icon={<GraduationCap size={15} />}
                    label="Class of"
                    value={String(profile.expected_grad_year)}
                  />
                )}
                {profile.major && (
                  <InfoRow icon={<GraduationCap size={15} />} label="Major" value={profile.major} />
                )}
                {profile.family_line && (
                  <InfoRow
                    icon={<GitBranch size={15} />}
                    label="Family line"
                    value={profile.family_line.name}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Positions */}
          {profile.positions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Positions</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border/50 -mt-2">
                {profile.positions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm font-medium text-foreground">
                      {p.title}
                      {p.is_acting && (
                        <span className="text-muted-foreground ml-1 font-normal">(acting)</span>
                      )}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {p.term_name}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {profile.bio && (
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Timeline */}
          <MemberTimeline profile={profile} />

          {/* Family tree: grandbig → big → you → littles → grandlittles */}
          <FamilyTree
            profile={profile}
            base={base}
            familyLineName={profile.family_line?.name ?? null}
          />

          <Card>
            <CardHeader>
              <CardTitle>Membership</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Role</dt>
                  <dd className="text-foreground">{profile.membership.role_type?.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Status</dt>
                  <dd className="text-foreground">{profile.membership.status_definition?.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Access level</dt>
                  <dd className="text-foreground capitalize">
                    {(profile.membership.role_type?.access_level ?? '').replace('_', ' ')}
                  </dd>
                </div>
                {profile.member_number && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Badge number</dt>
                    <dd className="text-foreground">#{profile.member_number}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MemberTimeline({ profile }: { profile: import('@/dal/person-profile').PersonProfile }) {
  type TimelineEvent = {
    date: string
    label: string
    detail?: string
    icon: React.ReactNode
    color: string
  }

  const events: TimelineEvent[] = []

  if (profile.membership.joined_at) {
    events.push({
      date: profile.membership.joined_at,
      label: 'Joined',
      detail: profile.family_line ? `${profile.family_line.name}` : undefined,
      icon: <Users size={13} />,
      color: 'text-info bg-info/10',
    })
  }

  if (profile.bid_date) {
    events.push({
      date: profile.bid_date,
      label: 'Bid Accepted',
      icon: <Hash size={13} />,
      color: 'text-brand bg-brand/10',
    })
  }

  if (profile.initiation_date) {
    events.push({
      date: profile.initiation_date,
      label: 'Initiated',
      detail: profile.member_number ? `Badge #${profile.member_number}` : undefined,
      icon: <Shield size={13} />,
      color: 'text-success bg-success/10',
    })
  }

  if (profile.expected_grad_year) {
    const gradDate = `${profile.expected_grad_year}-05-31`
    const isPast = new Date(gradDate) < new Date()
    events.push({
      date: gradDate,
      label: isPast ? 'Graduated' : 'Expected Graduation',
      detail: `Class of ${profile.expected_grad_year}`,
      icon: <GraduationCap size={13} />,
      color: isPast ? 'text-muted-foreground bg-muted' : 'text-warning bg-warning/10',
    })
  }

  // Sort chronologically
  events.sort((a, b) => a.date.localeCompare(b.date))

  if (events.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {events.map((event, i) => (
            <div key={`${event.date}-${event.label}`} className="flex gap-3 pb-5 last:pb-0">
              {/* Vertical line + dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${event.color}`}
                >
                  {event.icon}
                </div>
                {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              {/* Content */}
              <div className="pt-0.5 min-w-0">
                <p className="text-sm font-medium text-foreground">{event.label}</p>
                {event.detail && <p className="text-xs text-muted-foreground">{event.detail}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(event.date)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground break-words whitespace-pre-line">{value}</p>
      </div>
    </div>
  )
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return raw
}

function formatAddress(
  street: string | null,
  city: string | null,
  state: string | null,
  country: string | null
): string {
  const cityState = [city, state].filter(Boolean).join(', ')
  const parts = [street, cityState, country].filter(Boolean)
  return parts.join('\n')
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
