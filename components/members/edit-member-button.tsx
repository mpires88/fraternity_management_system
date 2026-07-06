'use client'

import { Pencil } from 'lucide-react'
import { useState } from 'react'
import type { PersonProfile } from '@/dal/person-profile'
import { EditMemberDialog } from './edit-member-dialog'

export function EditMemberButton({
  profile,
  roleTypes,
  statusDefinitions,
}: {
  profile: PersonProfile
  roleTypes: { id: string; name: string; slug: string }[]
  statusDefinitions: { id: string; name: string; slug: string; is_base: boolean }[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground bg-card border border-border hover:border-ring rounded-lg transition-colors"
      >
        <Pencil size={13} />
        Edit
      </button>
      {open && (
        <EditMemberDialog
          profile={profile}
          roleTypes={roleTypes}
          statusDefinitions={statusDefinitions}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
