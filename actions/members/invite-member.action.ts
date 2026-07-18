'use server'

import { createValidatedOrgAction } from '@/actions/utils/action-helpers'
import { inviteMemberDal } from '@/dal/members'
import { inviteMemberSchema } from '@/lib/validations/member'

export const inviteMember = createValidatedOrgAction(
  inviteMemberSchema,
  async (supabase, actor, groupId, input) => {
    const result = await inviteMemberDal(supabase, groupId, actor.personId, input)

    if (result.claimToken) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const claimUrl = `${baseUrl}/claim/${result.claimToken}`
      console.log(`[invite] Claim URL for ${input.full_name}: ${claimUrl}`)
      return { claimUrl }
    }

    return { claimUrl: null }
  }
)
