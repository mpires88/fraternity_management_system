'use server'

import { createValidatedAction, createValidatedOrgAction } from '@/actions/utils/action-helpers'
import { createChangeRequest, reviewChangeRequest } from '@/dal/change-requests'
import {
  reviewChangeRequestSchema,
  submitChangeRequestSchema,
} from '@/lib/validations/change-request'

export const submitChangeRequest = createValidatedAction(
  submitChangeRequestSchema,
  async (supabase, actor, input) => {
    await createChangeRequest(supabase, actor.personId, input)
  }
)

export const reviewChangeRequestAction = createValidatedOrgAction(
  reviewChangeRequestSchema,
  async (supabase, actor, _groupId, input) => {
    await reviewChangeRequest(supabase, input.request_id, input.decision, actor.personId)
  },
  { revalidatePaths: ['/admin'] }
)
