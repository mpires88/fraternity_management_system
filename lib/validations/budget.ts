import { z } from 'zod'

// NUMERIC(10,2): cap the magnitude and reject sub-cent precision so Postgres
// never silently rounds a validated amount
const moneyAmount = z.number().finite().max(99_999_999.99).multipleOf(0.01)

export const createBudgetSchema = z.object({
  title: z.string().min(1).max(200),
  term_id: z.string().uuid(),
  approval_mode: z.enum(['approver', 'vote', 'approver_then_vote']).default('approver'),
  approver_group_id: z.string().uuid().nullable().optional(),
  approver_position_id: z.string().uuid().nullable().optional(),
})

export const updateBudgetSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  approval_mode: z.enum(['approver', 'vote', 'approver_then_vote']).optional(),
  approver_group_id: z.string().uuid().nullable().optional(),
  approver_position_id: z.string().uuid().nullable().optional(),
})

export const createProposalSchema = z
  .object({
    budget_id: z.string().uuid(),
    position_id: z.string().uuid().nullable().optional(),
    subgroup_id: z.string().uuid().nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => !(v.position_id && v.subgroup_id), {
    message: 'A proposal belongs to a position or a subgroup, not both',
  })

export const updateProposalSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(2000).nullable().optional(),
})

export const submitProposalSchema = z.object({
  id: z.string().uuid(),
})

export const returnProposalSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(2000).nullable().optional(),
})

export const createLineItemSchema = z.object({
  proposal_id: z.string().uuid(),
  description: z.string().min(1).max(500),
  amount: moneyAmount.min(0),
  category: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  display_order: z.number().int().optional(),
})

export const updateLineItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(500).optional(),
  amount: moneyAmount.min(0).optional(),
  category: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  display_order: z.number().int().optional(),
})

export const deleteLineItemSchema = z.object({
  id: z.string().uuid(),
})

export const compileBudgetSchema = z.object({
  id: z.string().uuid(),
})

export const approveBudgetSchema = z.object({
  id: z.string().uuid(),
})

export const ratifyBudgetSchema = z.object({
  id: z.string().uuid(),
})

export const archiveBudgetSchema = z.object({
  id: z.string().uuid(),
})

export const deleteBudgetSchema = z.object({
  id: z.string().uuid(),
})

export const returnBudgetToDraftSchema = z.object({
  id: z.string().uuid(),
})

export const createRatificationPollSchema = z.object({
  id: z.string().uuid(),
})

export const deleteProposalSchema = z.object({
  id: z.string().uuid(),
})
