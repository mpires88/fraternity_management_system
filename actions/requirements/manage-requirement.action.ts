'use server'

import {
  createAuthenticatedAction,
  createOrgAuthenticatedAction,
} from '@/actions/utils/action-helpers'
import {
  archiveRequirementDal,
  bulkMarkAttendanceDal,
  createRequirementDal,
  getAudienceContext,
  getRequirementsForClone,
  insertAssignmentsDal,
  updateAssignmentOfficerDal,
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

type WaiveInput = { assignmentId: string; note: string }

export const waiveAssignment = createOrgAuthenticatedAction<WaiveInput, void>(
  async (supabase, _user, _groupId, input) => {
    await updateAssignmentOfficerDal(supabase, input.assignmentId, {
      status: 'waived',
      note: input.note,
    })
  }
)

type VerifyInput = { assignmentId: string }

export const verifyAssignment = createOrgAuthenticatedAction<VerifyInput, void>(
  async (supabase, user, _groupId, input) => {
    await updateAssignmentOfficerDal(supabase, input.assignmentId, {
      status: 'complete',
      verified_by: user.id,
    })
  }
)

type BulkAttendanceInput = { assignmentIds: string[] }

export const bulkMarkAttendance = createOrgAuthenticatedAction<BulkAttendanceInput, void>(
  async (supabase, _user, _groupId, input) => {
    await bulkMarkAttendanceDal(supabase, input.assignmentIds)
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

type CloneInput = { sourceTermId: string; targetTermId: string }

export const cloneRequirementsFromTerm = createOrgAuthenticatedAction<CloneInput, number>(
  async (supabase, user, groupId, input) => {
    const sourceReqs = await getRequirementsForClone(supabase, groupId, input.sourceTermId)
    if (sourceReqs.length === 0) return 0

    const [sourceTermRes, targetTermRes] = await Promise.all([
      supabase.from('terms').select('starts_on').eq('id', input.sourceTermId).single(),
      supabase.from('terms').select('starts_on').eq('id', input.targetTermId).single(),
    ])

    const sourceStart = sourceTermRes.data?.starts_on
    const targetStart = targetTermRes.data?.starts_on
    const deltaMs =
      sourceStart && targetStart
        ? new Date(targetStart).getTime() - new Date(sourceStart).getTime()
        : 0

    function shiftDate(iso: string | null): string | null {
      if (!iso || deltaMs === 0) return iso
      return new Date(new Date(iso).getTime() + deltaMs).toISOString()
    }

    const ctx = await getAudienceContext(supabase, groupId, input.targetTermId)

    for (const req of sourceReqs) {
      const reqId = await createRequirementDal(supabase, groupId, user.id, {
        title: req.title,
        description: req.description,
        kind: req.kind,
        due_at: shiftDate(req.due_at),
        occurs_at: shiftDate(req.occurs_at),
        amount_cents: req.amount_cents,
        quota_target: req.quota_target,
        quota_unit: req.quota_unit,
        requires_verification: req.requires_verification,
        assign_to: req.assign_to,
        audience_role_type_ids: req.audience_role_type_ids,
        audience_position_ids: req.audience_position_ids,
        audience_subgroup_ids: req.audience_subgroup_ids,
        term_id: input.targetTermId,
      })

      const personIds = expandAudience(
        {
          assign_to: req.assign_to as 'all_active',
          audience_role_type_ids: req.audience_role_type_ids,
          audience_position_ids: req.audience_position_ids,
          audience_subgroup_ids: req.audience_subgroup_ids,
        },
        ctx
      )

      await insertAssignmentsDal(supabase, reqId, personIds)
    }

    return sourceReqs.length
  }
)
