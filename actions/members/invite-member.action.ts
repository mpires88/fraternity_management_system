'use server'

import { createValidatedOrgAction } from '@/actions/utils/action-helpers'
import { inviteMemberDal } from '@/dal/members'
import { inviteMemberSchema } from '@/lib/validations/member'

export const inviteMember = createValidatedOrgAction(
  inviteMemberSchema,
  async (supabase, _user, groupId, input) => inviteMemberDal(supabase, groupId, input)
)
