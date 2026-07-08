'use client'

import { Camera } from 'lucide-react'
import { useRef, useState } from 'react'
import { MemberAvatar } from '@/components/shared/member-avatar'
import { createClient } from '@/lib/supabase/client'

export function ProfilePhotoUpload({
  personId,
  currentPhoto,
  fullName,
  onUploaded,
}: {
  personId: string
  currentPhoto: string | null
  fullName: string
  onUploaded: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const resized = await resizeImage(file, 512)
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${personId}/avatar.${ext}`

      const supabase = createClient()
      const { error } = await supabase.storage
        .from('profile-photos')
        .upload(path, resized, { upsert: true, contentType: resized.type })

      if (error) {
        console.error('Upload error:', error.message)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('profile-photos').getPublicUrl(path)

      onUploaded(`${publicUrl}?t=${Date.now()}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className="relative group shrink-0"
    >
      <MemberAvatar src={currentPhoto} fullName={fullName} size="xl" />
      <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Camera size={20} className="text-white" />
      </div>
      {uploading && (
        <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
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
    </button>
  )
}

function resizeImage(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize
          width = maxSize
        } else {
          width = (width / height) * maxSize
          height = maxSize
        }
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.85)
    }
    img.src = URL.createObjectURL(file)
  })
}
