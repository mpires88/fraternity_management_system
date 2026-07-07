'use server'

import {
  createAuthenticatedAction,
  createOrgAuthenticatedAction,
} from '@/actions/utils/action-helpers'
import {
  archiveRequirementDal,
  createRequirementDal,
  getAudienceContext,
  insertAssignmentsDal,
  updateAssignmentStatusDal,
  updateRequirementDal,
} from '@/dal/requirements'
import { expandAudience } from '@/lib/utils/requirements'
import type { CreateRequirementInput, UpdateRequirementInput } from '@/lib/validations/requirement'

export const createRequirement = createOrgAuthenticatedAction<CreateRequirementInput, void>(
  async (supabase, user, groupId, input) => {
    const requirementId = await createRequirementDal(supabase, groupId, user.id, input)

    const ctx = await getAudienceContext(supabase, groupId, input.term_id)
    const personIds = expandAudience(
      {
        assign_to: input.assign_to,
        audience_role_type_ids: input.audience_role_type_ids,
        audience_position_ids: input.audience_position_ids,
        audience_subgroup_ids: input.audience_subgroup_ids,
        custom_person_ids: input.custom_person_ids,
      },
      ctx
    )

    await insertAssignmentsDal(supabase, requirementId, personIds)
  }
)

export const updateRequirement = createOrgAuthenticatedAction<UpdateRequirementInput, void>(
  async (supabase, _user, _groupId, input) => {
    const { id, ...fields } = input
    await updateRequirementDal(supabase, id, fields)
  }
)

type ArchiveInput = { id: string }

export const archiveRequirement = createOrgAuthenticatedAction<ArchiveInput, void>(
  async (supabase, _user, _groupId, input) => archiveRequirementDal(supabase, input.id)
)

type AssignmentStatusInput = { assignmentId: string; status: string; progress?: number }

export const updateAssignmentStatus = createAuthenticatedAction<AssignmentStatusInput, void>(
  async (supabase, _user, input) => {
    await updateAssignmentStatusDal(supabase, input.assignmentId, input.status, input.progress)
  }
)

type SyncInput = { requirementId: string; termId: string }

export const syncRequirementAssignments = createOrgAuthenticatedAction<SyncInput, void>(
  async (supabase, _user, groupId, input) => {
    const { data: req } = await supabase
      .from('requirements')
      .select('assign_to, audience_role_type_ids, audience_position_ids, audience_subgroup_ids')
      .eq('id', input.requirementId)
      .single()

    if (!req) return

    const ctx = await getAudienceContext(supabase, groupId, input.termId)
    const personIds = expandAudience(
      {
        assign_to: req.assign_to as 'all_active',
        audience_role_type_ids: req.audience_role_type_ids,
        audience_position_ids: req.audience_position_ids,
        audience_subgroup_ids: req.audience_subgroup_ids,
      },
      ctx
    )

    await insertAssignmentsDal(supabase, input.requirementId, personIds)
  }
)
