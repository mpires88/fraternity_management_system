'use server'

import {
  createAuthenticatedAction,
  createOrgAuthenticatedAction,
} from '@/actions/utils/action-helpers'
import { getFullAccessPersonIdsDal } from '@/dal/members'
import {
  approveProgressEntryDal,
  archiveRequirementDal,
  bulkMarkAttendanceDal,
  createProgressEntryDal,
  createRequirementDal,
  getAssignmentSubmissionContextDal,
  getAudienceContext,
  getProgressEntryMetaDal,
  getRequirementById,
  getRequirementsForClone,
  getTermStartDatesDal,
  insertAssignmentsDal,
  rejectProgressEntryDal,
  updateAssignmentOfficerDal,
  updateAssignmentStatusDal,
  updateRequirementDal,
} from '@/dal/requirements'
import {
  notifyProgressApproved,
  notifyRequirementAssigned,
  notifySubmissionToVerify,
} from '@/lib/notifications/triggers'
import { expandAudience } from '@/lib/utils/requirements'
import type { CreateRequirementInput, UpdateRequirementInput } from '@/lib/validations/requirement'

export const createRequirement = createOrgAuthenticatedAction<CreateRequirementInput, void>(
  async (supabase, actor, groupId, input) => {
    const requirementId = await createRequirementDal(supabase, groupId, actor.personId, input)

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

    const assigneesExceptCreator = personIds.filter((pid) => pid !== actor.personId)
    await notifyRequirementAssigned(
      supabase,
      groupId,
      input.title,
      '/requirements',
      assigneesExceptCreator
    )
  }
)

export const updateRequirement = createOrgAuthenticatedAction<UpdateRequirementInput, void>(
  async (supabase, _actor, _groupId, input) => {
    const { id, ...fields } = input
    await updateRequirementDal(supabase, id, fields)
  }
)

type ArchiveInput = { id: string }

export const archiveRequirement = createOrgAuthenticatedAction<ArchiveInput, void>(
  async (supabase, _actor, _groupId, input) => archiveRequirementDal(supabase, input.id)
)

type AssignmentStatusInput = { assignmentId: string; status: string; progress?: number }

export const updateAssignmentStatus = createAuthenticatedAction<AssignmentStatusInput, void>(
  async (supabase, actor, input) => {
    await updateAssignmentStatusDal(supabase, input.assignmentId, input.status, input.progress)

    if (input.status === 'submitted') {
      const ctx = await getAssignmentSubmissionContextDal(supabase, input.assignmentId)
      if (ctx) {
        const officerIds = (await getFullAccessPersonIdsDal(supabase, ctx.groupId)).filter(
          (pid) => pid !== actor.personId
        )

        await notifySubmissionToVerify(
          supabase,
          ctx.groupId,
          ctx.submitterName,
          ctx.requirementTitle,
          '/requirements',
          officerIds
        )
      }
    }
  }
)

type WaiveInput = { assignmentId: string; note: string }

export const waiveAssignment = createOrgAuthenticatedAction<WaiveInput, void>(
  async (supabase, _actor, _groupId, input) => {
    await updateAssignmentOfficerDal(supabase, input.assignmentId, {
      status: 'waived',
      note: input.note,
    })
  }
)

type VerifyInput = { assignmentId: string }

export const verifyAssignment = createOrgAuthenticatedAction<VerifyInput, void>(
  async (supabase, actor, _groupId, input) => {
    await updateAssignmentOfficerDal(supabase, input.assignmentId, {
      status: 'complete',
      verified_by: actor.personId,
    })
  }
)

type BulkAttendanceInput = { assignmentIds: string[] }

export const bulkMarkAttendance = createOrgAuthenticatedAction<BulkAttendanceInput, void>(
  async (supabase, _actor, _groupId, input) => {
    await bulkMarkAttendanceDal(supabase, input.assignmentIds)
  }
)

type SyncInput = { requirementId: string; termId: string }

export const syncRequirementAssignments = createOrgAuthenticatedAction<SyncInput, void>(
  async (supabase, _actor, groupId, input) => {
    const req = await getRequirementById(supabase, input.requirementId)
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
  async (supabase, actor, groupId, input) => {
    const sourceReqs = await getRequirementsForClone(supabase, groupId, input.sourceTermId)
    if (sourceReqs.length === 0) return 0

    const termStarts = await getTermStartDatesDal(supabase, [
      input.sourceTermId,
      input.targetTermId,
    ])
    const sourceStart = termStarts[input.sourceTermId]
    const targetStart = termStarts[input.targetTermId]
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
      const reqId = await createRequirementDal(supabase, groupId, actor.personId, {
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

// --- Progress entries ---

type RecordProgressInput = {
  assignmentId: string
  amount: number
  occurredOn: string
  note: string | null
}

export const recordPayment = createOrgAuthenticatedAction<RecordProgressInput, void>(
  async (supabase, actor, _groupId, input) => {
    await createProgressEntryDal(supabase, {
      assignmentId: input.assignmentId,
      amount: input.amount,
      occurredOn: input.occurredOn,
      note: input.note,
      loggedBy: actor.personId,
      approvedBy: actor.personId,
    })
  }
)

export const logQuotaProgress = createAuthenticatedAction<RecordProgressInput, void>(
  async (supabase, actor, input) => {
    await createProgressEntryDal(supabase, {
      assignmentId: input.assignmentId,
      amount: input.amount,
      occurredOn: input.occurredOn,
      note: input.note,
      loggedBy: actor.personId,
      approvedBy: null,
    })
  }
)

type ApproveEntryInput = { entryId: string }

export const approveProgressEntry = createOrgAuthenticatedAction<ApproveEntryInput, void>(
  async (supabase, actor, groupId, input) => {
    await approveProgressEntryDal(supabase, input.entryId, actor.personId)

    const entry = await getProgressEntryMetaDal(supabase, input.entryId)
    if (entry && entry.loggedBy !== actor.personId) {
      await notifyProgressApproved(
        supabase,
        groupId,
        entry.loggedBy,
        entry.requirementTitle,
        '/requirements'
      )
    }
  }
)

type RejectEntryInput = { entryId: string }

export const rejectProgressEntry = createOrgAuthenticatedAction<RejectEntryInput, void>(
  async (supabase, _actor, _groupId, input) => {
    await rejectProgressEntryDal(supabase, input.entryId)
  }
)
