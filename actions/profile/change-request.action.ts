'use server'

import { createValidatedAction, createValidatedOrgAction } from '@/actions/utils/action-helpers'
import { createChangeRequest, reviewChangeRequest } from '@/dal/change-requests'
import {
  reviewChangeRequestSchema,
  submitChangeRequestSchema,
} from '@/lib/validations/change-request'

export const submitChangeRequest = createValidatedAction(
  submitChangeRequestSchema,
  async (supabase, user, input) => {
    const { data: person } = await supabase
      .from('persons')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!person) throw new Error('No linked member record')

    await createChangeRequest(supabase, person.id, input)
  }
)

export const reviewChangeRequestAction = createValidatedOrgAction(
  reviewChangeRequestSchema,
  async (supabase, user, _groupId, input) => {
    const { data: person } = await supabase
      .from('persons')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!person) throw new Error('No linked member record')

    await reviewChangeRequest(supabase, input.request_id, input.decision, person.id)
  },
  { revalidatePaths: ['/admin'] }
)
