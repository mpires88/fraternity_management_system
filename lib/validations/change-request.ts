import { z } from 'zod'

export const submitChangeRequestSchema = z.object({
  group_id: z.string().uuid(),
  field_name: z.string().min(1),
  current_value: z.string().nullable(),
  requested_value: z.string().min(1),
  reason: z.string().optional(),
})

export type SubmitChangeRequestInput = z.infer<typeof submitChangeRequestSchema>

export const reviewChangeRequestSchema = z.object({
  request_id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
})

export type ReviewChangeRequestInput = z.infer<typeof reviewChangeRequestSchema>
