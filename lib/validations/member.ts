import { z } from 'zod'

export const inviteMemberSchema = z.object({
  school_email: z.string().email('Valid email required'),
  full_name: z.string().min(1, 'Name is required'),
  role_type_id: z.string().uuid(),
  invite_email: z.string().email().optional(),
})

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>

export const updateMemberSchema = z.object({
  personId: z.string().uuid(),
  full_name: z.string().min(1).optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  preferred_name: z.string().nullable().optional(),
  nickname: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  personal_email: z.string().email().nullable().optional(),
  school_email: z.string().email().nullable().optional(),
  street_address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  major: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  role_type_id: z.string().uuid().optional(),
  status_id: z.string().uuid().optional(),
})

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>
