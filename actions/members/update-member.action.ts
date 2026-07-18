'use server'

import { createValidatedOrgAction } from '@/actions/utils/action-helpers'
import { updateMemberDal } from '@/dal/members'
import { updateMemberSchema } from '@/lib/validations/member'

export const updateMember = createValidatedOrgAction(
  updateMemberSchema,
  async (supabase, _actor, groupId, input) => updateMemberDal(supabase, groupId, input)
)
