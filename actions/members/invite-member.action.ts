'use server'

import { createValidatedOrgAction } from '@/actions/utils/action-helpers'
import { inviteMemberDal } from '@/dal/members'
import { inviteMemberSchema } from '@/lib/validations/member'

export const inviteMember = createValidatedOrgAction(
  inviteMemberSchema,
  async (supabase, user, groupId, input) => {
    const { data: person } = await supabase
      .from('persons')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    const result = await inviteMemberDal(supabase, groupId, person?.id ?? user.id, input)

    if (result.claimToken) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const claimUrl = `${baseUrl}/claim/${result.claimToken}`
      console.log(`[invite] Claim URL for ${input.full_name}: ${claimUrl}`)
      return { claimUrl }
    }

    return { claimUrl: null }
  }
)
