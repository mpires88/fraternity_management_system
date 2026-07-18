export const NOTIFICATION_TYPES = {
  REQUIREMENT_ASSIGNED: 'requirement_assigned',
  SUBMISSION_TO_VERIFY: 'submission_to_verify',
  PROGRESS_APPROVED: 'progress_approved',
  DUE_SOON: 'due_soon',
  POLL_PUBLISHED: 'poll_published',
  POLL_CLOSED: 'poll_closed',
  DOCUMENT_IN_REVIEW: 'document_in_review',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]
