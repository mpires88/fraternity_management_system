export const NOTIFICATION_TYPES = {
  REQUIREMENT_ASSIGNED: 'requirement_assigned',
  SUBMISSION_TO_VERIFY: 'submission_to_verify',
  PROGRESS_APPROVED: 'progress_approved',
  DUE_SOON: 'due_soon',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]
