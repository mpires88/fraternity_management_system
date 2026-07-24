import { z } from 'zod'

export const createProspectSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  school_year: z.string().nullable().optional(),
  is_legacy: z.boolean().optional(),
  term_id: z.string().uuid(),
})

export type CreateProspectInput = z.infer<typeof createProspectSchema>

export const updateProspectSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  school_year: z.string().nullable().optional(),
  is_legacy: z.boolean().optional(),
})

export type UpdateProspectInput = z.infer<typeof updateProspectSchema>

export const setProspectStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['prospect', 'offered', 'accepted', 'declined', 'withdrawn']),
})

export type SetProspectStatusInput = z.infer<typeof setProspectStatusSchema>

/** Per-group calendar window (0–24 hours) for the recruitment day/week views. */
export const recruitmentCalendarHoursSchema = z
  .object({
    start_hour: z.number().int().min(0).max(23),
    end_hour: z.number().int().min(1).max(24),
  })
  .refine((v) => v.end_hour > v.start_hour, {
    message: 'End hour must be after start hour',
    path: ['end_hour'],
  })

export type RecruitmentCalendarHoursInput = z.infer<typeof recruitmentCalendarHoursSchema>

export const createRecruitmentEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  starts_at: z.string().min(1, 'Start time is required'),
  ends_at: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  term_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
})

export type CreateRecruitmentEventInput = z.infer<typeof createRecruitmentEventSchema>

export const updateEventSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
})

export type UpdateEventInput = z.infer<typeof updateEventSchema>

export const addFeedbackSchema = z.object({
  prospect_id: z.string().uuid(),
  body: z.string().min(1, 'Feedback is required'),
  rating: z.number().int().min(1).max(5).nullable().optional(),
})

export type AddFeedbackInput = z.infer<typeof addFeedbackSchema>

export const convertProspectSchema = z.object({
  prospect_id: z.string().uuid(),
  role_type_id: z.string().uuid(),
  status_id: z.string().uuid(),
  subgroup_id: z.string().uuid().nullable().optional(),
})
