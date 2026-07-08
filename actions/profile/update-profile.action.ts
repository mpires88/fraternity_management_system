'use server'

import { createValidatedAction } from '@/actions/utils/action-helpers'
import { updateMyProfile } from '@/dal/person-profile'
import { updateProfileSchema } from '@/lib/validations/profile'

export const updateProfile = createValidatedAction(
  updateProfileSchema,
  async (supabase, user, input) => {
    const { data: person } = await supabase
      .from('persons')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!person) throw new Error('No linked member record')

    await updateMyProfile(supabase, person.id, input)
  },
  { revalidatePaths: ['/profile'] }
)
