import { z } from 'zod'

export const updateProfileSchema = z.object({
  preferred_name: z.string().nullable().optional(),
  nickname: z.string().nullable().optional(),
  personal_email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  street_address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  profile_photo: z.string().nullable().optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
