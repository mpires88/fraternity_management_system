'use server'

import {
  createAuthenticatedAction,
  createOrgAuthenticatedAction,
} from '@/actions/utils/action-helpers'
import {
  approveProgressEntryDal,
  archiveRequirementDal,
  bulkMarkAttendanceDal,
  createProgressEntryDal,
  createRequirementDal,
  getAudienceContext,
  getRequirementsForClone,
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
      const { data: assignment } = await supabase
        .from('requirement_assignments')
        .select(
          'requirements!inner(title, group_id), persons!requirement_assignments_person_id_fkey(full_name)'
        )
        .eq('id', input.assignmentId)
        .single()

      if (assignment) {
        const req = assignment.requirements as unknown as { title: string; group_id: string }
        const person = assignment.persons as unknown as { full_name: string }

        const { data: officers } = await supabase
          .from('group_memberships')
          .select('person_id, role_types!inner(access_level)')
          .eq('group_id', req.group_id)
          .eq('role_types.access_level', 'full')

        const officerIds = (officers ?? [])
          .map((o) => o.person_id)
          .filter((pid) => pid !== actor.personId)

        await notifySubmissionToVerify(
          supabase,
          req.group_id,
          person?.full_name ?? 'A member',
          req.title,
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
  async (supabase, actor, groupId, input) => {
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

    const { data: entry } = await supabase
      .from('requirement_progress_entries')
      .select('logged_by, requirement_assignments!inner(requirements!inner(title))')
      .eq('id', input.entryId)
      .single()

    if (entry && entry.logged_by !== actor.personId) {
      const ra = entry.requirement_assignments as unknown as {
        requirements: { title: string }
      }
      await notifyProgressApproved(
        supabase,
        groupId,
        entry.logged_by,
        ra.requirements.title,
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
