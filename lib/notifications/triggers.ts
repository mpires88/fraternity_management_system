import type { DbClient } from '@/dal/types'
import { NOTIFICATION_TYPES } from '@/lib/constants/notifications'

export async function notifyRequirementAssigned(
  supabase: DbClient,
  groupId: string,
  requirementTitle: string,
  requirementHref: string,
  personIds: string[]
) {
  if (personIds.length === 0) return

  const rows = personIds.map((pid) => ({
    person_id: pid,
    group_id: groupId,
    type: NOTIFICATION_TYPES.REQUIREMENT_ASSIGNED,
    group_key: `${NOTIFICATION_TYPES.REQUIREMENT_ASSIGNED}:${groupId}`,
    title: `New requirement: ${requirementTitle}`,
    href: requirementHref,
  }))

  await supabase.from('notifications').insert(rows)
}

export async function notifySubmissionToVerify(
  supabase: DbClient,
  groupId: string,
  submitterName: string,
  requirementTitle: string,
  requirementHref: string,
  officerPersonIds: string[]
) {
  if (officerPersonIds.length === 0) return

  const rows = officerPersonIds.map((pid) => ({
    person_id: pid,
    group_id: groupId,
    type: NOTIFICATION_TYPES.SUBMISSION_TO_VERIFY,
    group_key: `${NOTIFICATION_TYPES.SUBMISSION_TO_VERIFY}:${groupId}`,
    title: `${submitterName} submitted "${requirementTitle}" for verification`,
    href: requirementHref,
  }))

  await supabase.from('notifications').insert(rows)
}

export async function notifyProgressApproved(
  supabase: DbClient,
  groupId: string,
  personId: string,
  requirementTitle: string,
  requirementHref: string
) {
  await supabase.from('notifications').insert({
    person_id: personId,
    group_id: groupId,
    type: NOTIFICATION_TYPES.PROGRESS_APPROVED,
    title: `Your progress on "${requirementTitle}" was approved`,
    href: requirementHref,
  })
}
