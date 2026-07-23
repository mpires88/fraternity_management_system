import { z } from 'zod'

// NUMERIC(10,2): cap the magnitude and reject sub-cent precision so Postgres
// never silently rounds a validated amount
const moneyAmount = z.number().positive().finite().max(99_999_999.99).multipleOf(0.01)

export const submitReimbursementSchema = z.object({
  amount: moneyAmount,
  description: z.string().min(1).max(1000),
  occurred_on: z.iso.date(),
  receipt_paths: z.array(z.string().min(1).max(500)).max(10).nullable().optional(),
  proposal_id: z.string().uuid().nullable().optional(),
  term_id: z.string().uuid().nullable().optional(),
})

export const approveReimbursementSchema = z.object({
  id: z.string().uuid(),
  line_item_id: z.string().uuid().nullable().optional(),
})

export const rejectReimbursementSchema = z.object({
  id: z.string().uuid(),
  note: z.string().max(2000).nullable().optional(),
})

export const reimburseSchema = z.object({
  id: z.string().uuid(),
  note: z.string().max(2000).nullable().optional(),
  external_ref: z.string().max(200).nullable().optional(),
})

export const applyCreditSchema = z.object({
  id: z.string().uuid(),
  assignment_id: z.string().uuid(),
  note: z.string().max(2000).nullable().optional(),
})

export const withdrawReimbursementSchema = z.object({
  id: z.string().uuid(),
})
