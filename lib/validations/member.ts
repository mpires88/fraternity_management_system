import { z } from 'zod'

export const updateMemberSchema = z.object({
  personId: z.string().uuid(),
  groupId: z.string().uuid(),
  parentSlug: z.string().min(1),
  orgSlug: z.string().min(1),
  full_name: z.string().min(1).optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  preferred_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  personal_email: z.string().email().nullable().optional(),
  school_email: z.string().email().nullable().optional(),
  street_address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  nickname: z.string().nullable().optional(),
  major: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  status: z.enum(['active', 'probated', 'suspended', 'expelled', 'away', 'inactive']).optional(),
  membership_type_id: z.string().uuid().optional(),
})

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>

export const inviteMemberSchema = z.object({
  school_email: z.string().email('Valid email required'),
  full_name: z.string().min(1, 'Name is required'),
  membership_type_id: z.string().uuid(),
  groupId: z.string().uuid(),
  fraternityId: z.string().uuid(),
  parentSlug: z.string().min(1),
  orgSlug: z.string().min(1),
})

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
