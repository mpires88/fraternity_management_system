'use server'

import { createValidatedAction } from '@/actions/utils/action-helpers'
import { updateMyProfile } from '@/dal/person-profile'
import { updateProfileSchema } from '@/lib/validations/profile'

export const updateProfile = createValidatedAction(
  updateProfileSchema,
  async (supabase, actor, input) => {
    await updateMyProfile(supabase, actor.personId, input)
  },
  { revalidatePaths: ['/profile'] }
)
