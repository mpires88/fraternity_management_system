import { getGroupSlugPathDal } from '@/dal/orgs'
import type { DbClient } from '@/dal/types'
import { NOTIFICATION_TYPES } from '@/lib/constants/notifications'
import { buildGroupHref } from '@/lib/utils/hrefs'

/**
 * All notification hrefs must be group-prefixed (/[parent]/[org]/[group]/…) —
 * the trigger resolves the group's slug path itself so call sites only pass a
 * feature path like '/requirements'.
 */
async function resolveHref(
  supabase: DbClient,
  groupId: string,
  featurePath: string
): Promise<string> {
  const path = await getGroupSlugPathDal(supabase, groupId)
  return path ? buildGroupHref(path, featurePath) : featurePath
}

export async function notifyRequirementAssigned(
  supabase: DbClient,
  groupId: string,
  requirementTitle: string,
  featurePath: string,
  personIds: string[]
) {
  if (personIds.length === 0) return

  const href = await resolveHref(supabase, groupId, featurePath)
  const rows = personIds.map((pid) => ({
    person_id: pid,
    group_id: groupId,
    type: NOTIFICATION_TYPES.REQUIREMENT_ASSIGNED,
    group_key: `${NOTIFICATION_TYPES.REQUIREMENT_ASSIGNED}:${groupId}`,
    title: `New requirement: ${requirementTitle}`,
    href,
  }))

  await supabase.from('notifications').insert(rows)
}

export async function notifySubmissionToVerify(
  supabase: DbClient,
  groupId: string,
  submitterName: string,
  requirementTitle: string,
  featurePath: string,
  officerPersonIds: string[]
) {
  if (officerPersonIds.length === 0) return

  const href = await resolveHref(supabase, groupId, featurePath)
  const rows = officerPersonIds.map((pid) => ({
    person_id: pid,
    group_id: groupId,
    type: NOTIFICATION_TYPES.SUBMISSION_TO_VERIFY,
    group_key: `${NOTIFICATION_TYPES.SUBMISSION_TO_VERIFY}:${groupId}`,
    title: `${submitterName} submitted "${requirementTitle}" for verification`,
    href,
  }))

  await supabase.from('notifications').insert(rows)
}

export async function notifyPollPublished(
  supabase: DbClient,
  groupId: string,
  pollTitle: string,
  featurePath: string,
  participantPersonIds: string[]
) {
  if (participantPersonIds.length === 0) return

  const href = await resolveHref(supabase, groupId, featurePath)
  const rows = participantPersonIds.map((pid) => ({
    person_id: pid,
    group_id: groupId,
    type: NOTIFICATION_TYPES.POLL_PUBLISHED,
    group_key: `${NOTIFICATION_TYPES.POLL_PUBLISHED}:${groupId}`,
    title: `Vote open: ${pollTitle}`,
    href,
  }))

  await supabase.from('notifications').insert(rows)
}

export async function notifyPollClosed(
  supabase: DbClient,
  groupId: string,
  pollTitle: string,
  featurePath: string,
  participantPersonIds: string[]
) {
  if (participantPersonIds.length === 0) return

  const href = await resolveHref(supabase, groupId, featurePath)
  const rows = participantPersonIds.map((pid) => ({
    person_id: pid,
    group_id: groupId,
    type: NOTIFICATION_TYPES.POLL_CLOSED,
    group_key: `${NOTIFICATION_TYPES.POLL_CLOSED}:${groupId}`,
    title: `Results ready: ${pollTitle}`,
    href,
  }))

  await supabase.from('notifications').insert(rows)
}

export async function notifyDocumentInReview(
  supabase: DbClient,
  groupId: string,
  documentTitle: string,
  featurePath: string,
  personIds: string[]
) {
  if (personIds.length === 0) return

  const href = await resolveHref(supabase, groupId, featurePath)
  const rows = personIds.map((pid) => ({
    person_id: pid,
    group_id: groupId,
    type: NOTIFICATION_TYPES.DOCUMENT_IN_REVIEW,
    group_key: `${NOTIFICATION_TYPES.DOCUMENT_IN_REVIEW}:${groupId}`,
    title: `Ready for review: ${documentTitle}`,
    href,
  }))

  await supabase.from('notifications').insert(rows)
}

export async function notifyProgressApproved(
  supabase: DbClient,
  groupId: string,
  personId: string,
  requirementTitle: string,
  featurePath: string
) {
  await supabase.from('notifications').insert({
    person_id: personId,
    group_id: groupId,
    type: NOTIFICATION_TYPES.PROGRESS_APPROVED,
    title: `Your progress on "${requirementTitle}" was approved`,
    href: await resolveHref(supabase, groupId, featurePath),
  })
}
