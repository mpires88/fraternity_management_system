'use server'

import { createOrgAuthenticatedAction } from '@/actions/utils/action-helpers'
import { addSubgroupMemberDal, createSubgroupDal, removeSubgroupMemberDal } from '@/dal/subgroups'

type CreateSubgroupInput = {
  name: string
  subgroup_type: string
  membership_type?: string
  is_private?: boolean
}

export const createSubgroup = createOrgAuthenticatedAction<CreateSubgroupInput, void>(
  async (supabase, _actor, groupId, input) => createSubgroupDal(supabase, groupId, input)
)

type AddMemberInput = {
  subgroupId: string
  personId: string
  role?: string
}

export const addSubgroupMember = createOrgAuthenticatedAction<AddMemberInput, void>(
  async (supabase, actor, _groupId, input) => addSubgroupMemberDal(supabase, actor.personId, input)
)

type RemoveMemberInput = {
  membershipId: string
}

export const removeSubgroupMember = createOrgAuthenticatedAction<RemoveMemberInput, void>(
  async (supabase, _actor, _groupId, input) => removeSubgroupMemberDal(supabase, input.membershipId)
)
