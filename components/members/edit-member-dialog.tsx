'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { updateMember } from '@/actions/members/update-member.action'
import type { PersonProfile } from '@/dal/person-profile'
import { useOrg } from '@/lib/context/org-context'

export function EditMemberDialog({
  profile,
  roleTypes,
  statusDefinitions,
  onClose,
}: {
  profile: PersonProfile
  roleTypes: { id: string; name: string; slug: string }[]
  statusDefinitions: { id: string; name: string; slug: string; is_base: boolean }[]
  onClose: () => void
}) {
  const { parentOrg, org } = useOrg()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    full_name: profile.full_name,
    first_name: profile.first_name ?? '',
    last_name: profile.last_name ?? '',
    preferred_name: profile.preferred_name ?? '',
    nickname: profile.nickname ?? '',
    phone: profile.phone ?? '',
    personal_email: profile.personal_email ?? '',
    street_address: profile.street_address ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
    country: profile.country ?? '',
    major: profile.major ?? '',
    bio: profile.bio ?? '',
    role_type_id: profile.membership.role_type_id ?? '',
    status_id: profile.membership.status_id ?? '',
  })

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await updateMember({
        personId: profile.id,
        groupId: org.id,
        parentSlug: parentOrg?.slug ?? null,
        orgSlug: org.slug,
        full_name: form.full_name,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        preferred_name: form.preferred_name || null,
        nickname: form.nickname || null,
        phone: form.phone || null,
        personal_email: form.personal_email || null,
        street_address: form.street_address || null,
        city: form.city || null,
        state: form.state || null,
        country: form.country || null,
        major: form.major || null,
        bio: form.bio || null,
        role_type_id: form.role_type_id,
        status_id: form.status_id,
      })
      if (!result.success) {
        setError(result.error ?? 'Failed to update')
        return
      }
      router.refresh()
      onClose()
    })
  }

  // Separate base and extended statuses for clarity
  const baseStatuses = statusDefinitions.filter((s) => s.is_base)
  const extendedStatuses = statusDefinitions.filter((s) => !s.is_base)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Edit Member</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-lg"
            >
              &times;
            </button>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* ── Role & Status ── */}
            <Section title="Role & Status">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Role
                  </label>
                  <select
                    value={form.role_type_id}
                    onChange={(e) => update('role_type_id', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    {roleTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Status
                  </label>
                  <select
                    value={form.status_id}
                    onChange={(e) => update('status_id', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    {baseStatuses.length > 0 && (
                      <optgroup label="Base">
                        {baseStatuses.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {extendedStatuses.length > 0 && (
                      <optgroup label="Extended">
                        {extendedStatuses.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>
            </Section>

            {/* ── Name ── */}
            <Section title="Name">
              <Field
                label="Full name"
                value={form.full_name}
                onChange={(v) => update('full_name', v)}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="First name"
                  value={form.first_name}
                  onChange={(v) => update('first_name', v)}
                />
                <Field
                  label="Last name"
                  value={form.last_name}
                  onChange={(v) => update('last_name', v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Preferred name"
                  value={form.preferred_name}
                  onChange={(v) => update('preferred_name', v)}
                  placeholder="Goes by..."
                />
                <Field
                  label="Brother nickname"
                  value={form.nickname}
                  onChange={(v) => update('nickname', v)}
                />
              </div>
            </Section>

            {/* ── Contact ── */}
            <Section title="Contact">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone" value={form.phone} onChange={(v) => update('phone', v)} />
                <Field
                  label="Personal email"
                  value={form.personal_email}
                  onChange={(v) => update('personal_email', v)}
                  type="email"
                />
              </div>
            </Section>

            {/* ── Address ── */}
            <Section title="Address">
              <Field
                label="Street"
                value={form.street_address}
                onChange={(v) => update('street_address', v)}
              />
              <div className="grid grid-cols-3 gap-3">
                <Field label="City" value={form.city} onChange={(v) => update('city', v)} />
                <Field label="State" value={form.state} onChange={(v) => update('state', v)} />
                <Field
                  label="Country"
                  value={form.country}
                  onChange={(v) => update('country', v)}
                />
              </div>
            </Section>

            {/* ── Academic ── */}
            <Section title="Academic">
              <Field label="Major" value={form.major} onChange={(v) => update('major', v)} />
            </Section>

            {/* ── About ── */}
            <Section title="About">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Bio</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => update('bio', e.target.value)}
                  rows={3}
                  placeholder="A short bio..."
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                />
              </div>
            </Section>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground text-sm rounded-lg font-medium transition-colors"
            >
              {isPending ? 'Saving\u2026' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
      />
    </div>
  )
}
