'use client'

import {
  GitBranch,
  GraduationCap,
  Hash,
  Lock,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { updateProfile } from '@/actions/profile/update-profile.action'
import { ChangeRequestDialog } from '@/components/profile/change-request-dialog'
import { ProfilePhotoUpload } from '@/components/profile/profile-photo-upload'
import { MemberAvatar } from '@/components/shared/member-avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ChangeRequest } from '@/dal/change-requests'
import type { PersonProfile } from '@/dal/person-profile'

export function ProfilePage({
  profile,
  groupId,
  changeRequests,
}: {
  profile: PersonProfile
  groupId: string
  changeRequests: ChangeRequest[]
}) {
  const [crDialog, setCrDialog] = useState<{
    fieldName: string
    fieldLabel: string
    currentValue: string | null
  } | null>(null)

  const pendingCRs = new Set(
    changeRequests.filter((cr) => cr.status === 'pending').map((cr) => cr.field_name)
  )
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function save(fields: Record<string, unknown>) {
    startTransition(async () => {
      const result = await updateProfile(fields)
      if (result.success) router.refresh()
    })
  }

  const formalName =
    [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ') ||
    profile.full_name

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        <ProfilePhotoUpload
          personId={profile.id}
          currentPhoto={profile.profile_photo}
          fullName={profile.full_name}
          onUploaded={(url) => save({ profile_photo: url })}
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{profile.full_name}</h1>
          {(profile.preferred_name || profile.nickname) && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {profile.preferred_name &&
                profile.preferred_name !== profile.first_name &&
                `Goes by ${profile.preferred_name}`}
              {profile.preferred_name && profile.nickname && ' · '}
              {profile.nickname && `"${profile.nickname}"`}
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
              <Badge variant="outline" className="text-xs">
                {profile.membership.status_definition?.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Info — editable */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <EditableField
                label="Preferred name"
                icon={<User size={15} />}
                value={profile.preferred_name}
                onSave={(v) => save({ preferred_name: v || null })}
                saving={isPending}
              />
              <EditableField
                label="Nickname"
                icon={<User size={15} />}
                value={profile.nickname}
                onSave={(v) => save({ nickname: v || null })}
                saving={isPending}
              />
              <EditableField
                label="Personal email"
                icon={<Mail size={15} />}
                value={profile.personal_email}
                onSave={(v) => save({ personal_email: v || null })}
                saving={isPending}
                type="email"
              />
              <EditableField
                label="Phone"
                icon={<Phone size={15} />}
                value={profile.phone}
                onSave={(v) => save({ phone: v || null })}
                saving={isPending}
                type="tel"
              />
              <EditableField
                label="Bio"
                icon={<User size={15} />}
                value={profile.bio}
                onSave={(v) => save({ bio: v || null })}
                saving={isPending}
                multiline
              />
            </CardContent>
          </Card>

          {/* Address — editable */}
          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <EditableField
                label="Street address"
                icon={<MapPin size={15} />}
                value={profile.street_address}
                onSave={(v) => save({ street_address: v || null })}
                saving={isPending}
              />
              <div className="grid grid-cols-2 gap-4">
                <EditableField
                  label="City"
                  value={profile.city}
                  onSave={(v) => save({ city: v || null })}
                  saving={isPending}
                />
                <EditableField
                  label="State"
                  value={profile.state}
                  onSave={(v) => save({ state: v || null })}
                  saving={isPending}
                />
              </div>
              <EditableField
                label="Country"
                value={profile.country}
                onSave={(v) => save({ country: v || null })}
                saving={isPending}
              />
            </CardContent>
          </Card>

          {/* Chapter Info — read-only with change request buttons */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Chapter Information
                <Lock size={14} className="text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ReadOnlyField label="Full name" icon={<User size={15} />} value={formalName} />
                <ChangeableField
                  label="School email"
                  fieldName="school_email"
                  icon={<Mail size={15} />}
                  value={profile.school_email}
                  pending={pendingCRs.has('school_email')}
                  onRequest={(f, l, v) =>
                    setCrDialog({ fieldName: f, fieldLabel: l, currentValue: v })
                  }
                />
                <ChangeableField
                  label="Class of"
                  fieldName="expected_grad_year"
                  icon={<GraduationCap size={15} />}
                  value={profile.expected_grad_year ? String(profile.expected_grad_year) : null}
                  pending={pendingCRs.has('expected_grad_year')}
                  onRequest={(f, l, v) =>
                    setCrDialog({ fieldName: f, fieldLabel: l, currentValue: v })
                  }
                />
                <ChangeableField
                  label="Major"
                  fieldName="major"
                  icon={<GraduationCap size={15} />}
                  value={profile.major}
                  pending={pendingCRs.has('major')}
                  onRequest={(f, l, v) =>
                    setCrDialog({ fieldName: f, fieldLabel: l, currentValue: v })
                  }
                />
                {profile.member_number && (
                  <ReadOnlyField
                    label="Badge number"
                    icon={<Hash size={15} />}
                    value={`#${profile.member_number}`}
                  />
                )}
                {profile.initiation_date && (
                  <ReadOnlyField
                    label="Initiation date"
                    icon={<Shield size={15} />}
                    value={formatDate(profile.initiation_date)}
                  />
                )}
                {profile.bid_date && (
                  <ReadOnlyField
                    label="Bid date"
                    icon={<Hash size={15} />}
                    value={formatDate(profile.bid_date)}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bio display */}
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

          {crDialog && (
            <ChangeRequestDialog
              fieldName={crDialog.fieldName}
              fieldLabel={crDialog.fieldLabel}
              currentValue={crDialog.currentValue}
              groupId={groupId}
              onClose={() => setCrDialog(null)}
            />
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Family */}
          {(profile.big || profile.littles.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch size={15} />
                  Family
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.family_line && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {profile.family_line.name} family
                  </p>
                )}
                {profile.big && (
                  <div className="flex items-center gap-2">
                    <MemberAvatar
                      src={profile.big.profile_photo}
                      fullName={profile.big.full_name}
                      size="sm"
                    />
                    <div>
                      <p className="text-xs text-muted-foreground">Big</p>
                      <p className="text-sm text-foreground">{profile.big.full_name}</p>
                    </div>
                  </div>
                )}
                {profile.littles.map((l) => (
                  <div key={l.id} className="flex items-center gap-2">
                    <MemberAvatar src={l.profile_photo} fullName={l.full_name} size="sm" />
                    <div>
                      <p className="text-xs text-muted-foreground">Little</p>
                      <p className="text-sm text-foreground">{l.full_name}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

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

          {/* Membership */}
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
                {profile.membership.joined_at && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Member since</dt>
                    <dd className="text-foreground">{formatDate(profile.membership.joined_at)}</dd>
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

function EditableField({
  label,
  icon,
  value,
  onSave,
  saving,
  type = 'text',
  multiline = false,
}: {
  label: string
  icon?: React.ReactNode
  value: string | null
  onSave: (val: string) => void
  saving: boolean
  type?: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  function handleSave() {
    if (draft !== (value ?? '')) {
      onSave(draft)
    }
    setEditing(false)
  }

  function handleCancel() {
    setDraft(value ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <div className="flex items-start gap-2">
          {multiline ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="flex-1 px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
              ref={(el) => el?.focus()}
            />
          ) : (
            <input
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              ref={(el) => el?.focus()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') handleCancel()
              }}
            />
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground rounded-lg text-xs font-medium transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value ?? '')
        setEditing(true)
      }}
      className="flex items-start gap-2.5 w-full text-left group"
    >
      {icon && <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground group-hover:text-brand transition-colors">
          {value || <span className="text-muted-foreground italic">Not set</span>}
        </p>
      </div>
      <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1">
        Edit
      </span>
    </button>
  )
}

function ReadOnlyField({
  label,
  icon,
  value,
}: {
  label: string
  icon?: React.ReactNode
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      {icon && <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  )
}

function ChangeableField({
  label,
  fieldName,
  icon,
  value,
  pending,
  onRequest,
}: {
  label: string
  fieldName: string
  icon?: React.ReactNode
  value: string | null
  pending: boolean
  onRequest: (fieldName: string, label: string, currentValue: string | null) => void
}) {
  return (
    <div className="flex items-start gap-2.5 group">
      {icon && <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">
          {value || <span className="italic text-muted-foreground">Not set</span>}
        </p>
      </div>
      {pending ? (
        <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
          Pending
        </Badge>
      ) : (
        <button
          type="button"
          onClick={() => onRequest(fieldName, label, value)}
          className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-brand transition-all mt-1 shrink-0"
        >
          Request change
        </button>
      )}
    </div>
  )
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
