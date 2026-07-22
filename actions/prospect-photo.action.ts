'use server'

import { createOrgAuthenticatedAction } from '@/actions/utils/action-helpers'
import { setProspectPhotoDal } from '@/dal/prospect-photos'

/**
 * Save (or clear) a prospect's photo path after the client uploads the file
 * to the private prospect-photos bucket. Writing to prospects is gated by the
 * recruitment-manager RLS policy, so non-managers can't change it.
 */
export const setProspectPhoto = createOrgAuthenticatedAction<
  { prospectId: string; photoPath: string | null },
  void
>(
  async (supabase, _actor, _groupId, input) => {
    await setProspectPhotoDal(supabase, input.prospectId, input.photoPath)
  },
  { revalidatePaths: ['/recruitment'] }
)
