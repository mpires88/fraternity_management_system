import type { DbClient } from '@/dal/types'
import { UserFacingError } from '@/lib/errors'

/**
 * Prospect photos live in the private `prospect-photos` bucket, so they're
 * shown via short-lived signed URLs rather than public URLs.
 *
 * S3 SWAP POINT (production target, deferred 2026-07-21): prospects.photo_path
 * stores an opaque key, so moving to direct AWS S3 means changing only the
 * upload (prospect-photo-upload.tsx) and these resolver functions to
 * presigned PUT/GET — the column, action, and UI stay put.
 */
const BUCKET = 'prospect-photos'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

/** Set (or clear, with null) a prospect's stored photo path. */
export async function setProspectPhotoDal(
  supabase: DbClient,
  prospectId: string,
  photoPath: string | null
): Promise<void> {
  const { error } = await supabase
    .from('prospects')
    .update({ photo_path: photoPath, updated_at: new Date().toISOString() })
    .eq('id', prospectId)
  if (error) throw new UserFacingError(error.message)
}

/** Signed display URL for one stored path (null in, null out). */
export async function resolveProspectPhotoUrlDal(
  supabase: DbClient,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  return data?.signedUrl ?? null
}

/** Batch signed URLs keyed by path — one round trip for a whole board. */
export async function resolveProspectPhotoUrlsDal(
  supabase: DbClient,
  paths: (string | null | undefined)[]
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))]
  if (unique.length === 0) return {}
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS)
  const out: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl
  }
  return out
}
