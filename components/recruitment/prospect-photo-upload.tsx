'use client'

import { Camera, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { setProspectPhoto } from '@/actions/prospect-photo.action'
import { resizeImage } from '@/components/profile/profile-photo-upload'
import { MemberAvatar } from '@/components/shared/member-avatar'
import { createClient } from '@/lib/supabase/client'

/**
 * Photo upload for a prospect (private bucket). Shows the current photo or an
 * initials placeholder; clicking replaces it. Manager-only surface — the
 * prospects-update RLS enforces it too.
 */
export function ProspectPhotoUpload({
  prospectId,
  uploaderPersonId,
  fullName,
  currentPhotoUrl,
  hasPhoto,
}: {
  prospectId: string
  uploaderPersonId: string
  fullName: string
  currentPhotoUrl: string | null
  hasPhoto: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const resized = await resizeImage(file, 512)
      // Folder keyed by uploader person_id (storage RLS); one file per prospect
      const path = `${uploaderPersonId}/${prospectId}.jpg`
      const supabase = createClient()
      const { error } = await supabase.storage
        .from('prospect-photos')
        .upload(path, resized, { upsert: true, contentType: 'image/jpeg' })
      if (error) {
        console.error('Prospect photo upload failed:', error.message)
        return
      }
      const result = await setProspectPhoto({ prospectId, photoPath: path })
      if (result.success) router.refresh()
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    setUploading(true)
    try {
      const result = await setProspectPhoto({ prospectId, photoPath: null })
      if (result.success) router.refresh()
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative group shrink-0"
        aria-label={hasPhoto ? 'Change prospect photo' : 'Add prospect photo'}
      >
        <MemberAvatar src={currentPhotoUrl} fullName={fullName} size="xl" />
        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera size={18} className="text-white" />
        </div>
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Photo</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="hover:text-foreground transition-colors disabled:opacity-50"
          >
            {hasPhoto ? 'Replace' : 'Upload'}
          </button>
          {hasPhoto && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="inline-flex items-center gap-1 hover:text-destructive transition-colors disabled:opacity-50"
            >
              <X size={11} /> Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
