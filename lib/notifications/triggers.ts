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

export async function notifyBudgetProposalSubmitted(
  supabase: DbClient,
  groupId: string,
  positionName: string,
  featurePath: string,
  treasurerPersonIds: string[]
) {
  if (treasurerPersonIds.length === 0) return

  const href = await resolveHref(supabase, groupId, featurePath)
  const rows = treasurerPersonIds.map((pid) => ({
    person_id: pid,
    group_id: groupId,
    type: NOTIFICATION_TYPES.BUDGET_PROPOSAL_SUBMITTED,
    group_key: `${NOTIFICATION_TYPES.BUDGET_PROPOSAL_SUBMITTED}:${groupId}`,
    title: `Budget proposal submitted: ${positionName}`,
    href,
  }))

  await supabase.from('notifications').insert(rows)
}

export async function notifyBudgetReturned(
  supabase: DbClient,
  groupId: string,
  budgetTitle: string,
  featurePath: string,
  holderPersonId: string
) {
  await supabase.from('notifications').insert({
    person_id: holderPersonId,
    group_id: groupId,
    type: NOTIFICATION_TYPES.BUDGET_RETURNED,
    title: `Your proposal was returned: ${budgetTitle}`,
    href: await resolveHref(supabase, groupId, featurePath),
  })
}

export async function notifyBudgetRatified(
  supabase: DbClient,
  groupId: string,
  budgetTitle: string,
  featurePath: string,
  personIds: string[]
) {
  if (personIds.length === 0) return

  const href = await resolveHref(supabase, groupId, featurePath)
  const rows = personIds.map((pid) => ({
    person_id: pid,
    group_id: groupId,
    type: NOTIFICATION_TYPES.BUDGET_RATIFIED,
    group_key: `${NOTIFICATION_TYPES.BUDGET_RATIFIED}:${groupId}`,
    title: `Budget ratified: ${budgetTitle}`,
    href,
  }))

  await supabase.from('notifications').insert(rows)
}

export async function notifyReimbursementSubmitted(
  supabase: DbClient,
  groupId: string,
  submitterName: string,
  featurePath: string,
  officerPersonIds: string[]
) {
  if (officerPersonIds.length === 0) return

  const href = await resolveHref(supabase, groupId, featurePath)
  const rows = officerPersonIds.map((pid) => ({
    person_id: pid,
    group_id: groupId,
    type: NOTIFICATION_TYPES.REIMBURSEMENT_SUBMITTED,
    group_key: `${NOTIFICATION_TYPES.REIMBURSEMENT_SUBMITTED}:${groupId}`,
    title: `${submitterName} submitted a reimbursement request`,
    href,
  }))

  await supabase.from('notifications').insert(rows)
}

export async function notifyReimbursementToTreasurer(
  supabase: DbClient,
  groupId: string,
  submitterName: string,
  featurePath: string,
  treasurerPersonIds: string[]
) {
  if (treasurerPersonIds.length === 0) return

  const href = await resolveHref(supabase, groupId, featurePath)
  const rows = treasurerPersonIds.map((pid) => ({
    person_id: pid,
    group_id: groupId,
    type: NOTIFICATION_TYPES.REIMBURSEMENT_TO_TREASURER,
    group_key: `${NOTIFICATION_TYPES.REIMBURSEMENT_TO_TREASURER}:${groupId}`,
    title: `Reimbursement approved for ${submitterName} — ready for payout`,
    href,
  }))

  await supabase.from('notifications').insert(rows)
}

export async function notifyReimbursementResolved(
  supabase: DbClient,
  groupId: string,
  resolution: 'reimbursed' | 'credited' | 'rejected',
  featurePath: string,
  submitterPersonId: string
) {
  const labels = {
    reimbursed: 'Your reimbursement has been paid out',
    credited: 'Your reimbursement was applied as a credit',
    rejected: 'Your reimbursement request was declined',
  }

  await supabase.from('notifications').insert({
    person_id: submitterPersonId,
    group_id: groupId,
    type: NOTIFICATION_TYPES.REIMBURSEMENT_RESOLVED,
    title: labels[resolution],
    href: await resolveHref(supabase, groupId, featurePath),
  })
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

// ── Issues ─────────────────────────────────────────────────────────────────

export async function notifyIssueReported(
  supabase: DbClient,
  groupId: string,
  issueTitle: string,
  priority: string,
  featurePath: string,
  managerPersonIds: string[]
) {
  if (managerPersonIds.length === 0) return

  const href = await resolveHref(supabase, groupId, featurePath)
  const prefix = priority === 'emergency' ? '🚨 EMERGENCY: ' : ''
  const rows = managerPersonIds.map((pid) => ({
    person_id: pid,
    group_id: groupId,
    type: NOTIFICATION_TYPES.ISSUE_REPORTED,
    group_key: `${NOTIFICATION_TYPES.ISSUE_REPORTED}:${groupId}`,
    title: `${prefix}New issue reported: ${issueTitle}`,
    href,
  }))

  await supabase.from('notifications').insert(rows)
}

export async function notifyIssueStatusChanged(
  supabase: DbClient,
  groupId: string,
  issueTitle: string,
  newStatus: string,
  featurePath: string,
  reporterPersonId: string
) {
  const labels: Record<string, string> = {
    acknowledged: 'acknowledged',
    in_progress: 'in progress',
    resolved: 'resolved',
    wont_fix: "closed (won't fix)",
  }

  await supabase.from('notifications').insert({
    person_id: reporterPersonId,
    group_id: groupId,
    type: NOTIFICATION_TYPES.ISSUE_STATUS_CHANGED,
    title: `Your issue "${issueTitle}" is now ${labels[newStatus] ?? newStatus}`,
    href: await resolveHref(supabase, groupId, featurePath),
  })
}

export async function notifyIssueAssigned(
  supabase: DbClient,
  groupId: string,
  issueTitle: string,
  featurePath: string,
  assigneePersonId: string
) {
  await supabase.from('notifications').insert({
    person_id: assigneePersonId,
    group_id: groupId,
    type: NOTIFICATION_TYPES.ISSUE_ASSIGNED,
    title: `You've been assigned: ${issueTitle}`,
    href: await resolveHref(supabase, groupId, featurePath),
  })
}

export async function notifyIssueEscalated(
  supabase: DbClient,
  escalatedToGroupId: string,
  issueTitle: string,
  fromGroupName: string,
  featurePath: string,
  managerPersonIds: string[]
) {
  if (managerPersonIds.length === 0) return

  const href = await resolveHref(supabase, escalatedToGroupId, featurePath)
  const rows = managerPersonIds.map((pid) => ({
    person_id: pid,
    group_id: escalatedToGroupId,
    type: NOTIFICATION_TYPES.ISSUE_ESCALATED,
    group_key: `${NOTIFICATION_TYPES.ISSUE_ESCALATED}:${escalatedToGroupId}`,
    title: `Issue escalated from ${fromGroupName}: ${issueTitle}`,
    href,
  }))

  await supabase.from('notifications').insert(rows)
}
