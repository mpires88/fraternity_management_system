import { z } from 'zod'

const assignToEnum = z.enum(['all_active', 'role_types', 'positions', 'subgroups', 'custom'])
const kindEnum = z.enum(['task', 'payment', 'attendance', 'quota'])

export const createRequirementSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().nullable().optional(),
    kind: kindEnum,
    due_at: z.string().nullable().optional(),
    occurs_at: z.string().nullable().optional(),
    amount_cents: z.number().int().positive().nullable().optional(),
    quota_target: z.number().positive().nullable().optional(),
    quota_unit: z.string().nullable().optional(),
    requires_verification: z.boolean().optional(),
    assign_to: assignToEnum,
    audience_role_type_ids: z.array(z.string().uuid()).nullable().optional(),
    audience_position_ids: z.array(z.string().uuid()).nullable().optional(),
    audience_subgroup_ids: z.array(z.string().uuid()).nullable().optional(),
    custom_person_ids: z.array(z.string().uuid()).nullable().optional(),
    term_id: z.string().uuid(),
  })
  .refine((d) => d.kind !== 'payment' || (d.amount_cents && d.amount_cents > 0), {
    message: 'Payment requires amount_cents',
    path: ['amount_cents'],
  })
  .refine((d) => d.kind !== 'quota' || (d.quota_target && d.quota_target > 0), {
    message: 'Quota requires quota_target',
    path: ['quota_target'],
  })

export type CreateRequirementInput = z.infer<typeof createRequirementSchema>

export const updateRequirementSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  occurs_at: z.string().nullable().optional(),
  amount_cents: z.number().int().positive().nullable().optional(),
  quota_target: z.number().positive().nullable().optional(),
  quota_unit: z.string().nullable().optional(),
  requires_verification: z.boolean().optional(),
})

export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>
