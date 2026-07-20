'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SCHOOL_YEAR_OPTIONS } from '@/lib/constants/labels'

type Props = {
  onSubmit: (data: {
    full_name: string
    email?: string | null
    phone?: string | null
    school_year?: string | null
    is_legacy?: boolean
  }) => void
  onClose: () => void
}

export function AddProspectDialog({ onSubmit, onClose }: Props) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [schoolYear, setSchoolYear] = useState('')
  const [isLegacy, setIsLegacy] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) return
    onSubmit({
      full_name: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      school_year: schoolYear.trim() || null,
      is_legacy: isLegacy,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Prospect</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label htmlFor="ap-name" className="text-sm font-medium text-muted-foreground">
                Full Name *
              </label>
              <input
                id="ap-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="ap-email" className="text-sm font-medium text-muted-foreground">
                Email
              </label>
              <input
                id="ap-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="ap-phone" className="text-sm font-medium text-muted-foreground">
                Phone
              </label>
              <input
                id="ap-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="ap-year" className="text-sm font-medium text-muted-foreground">
                School Year
              </label>
              <select
                id="ap-year"
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                {SCHOOL_YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isLegacy}
                onChange={(e) => setIsLegacy(e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-sm">Legacy candidate</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!fullName.trim()}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Add Prospect
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
