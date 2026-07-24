import { z } from 'zod'

export const assignRoomSchema = z.object({
  room_id: z.string().uuid(),
  member_id: z.string().uuid(),
  term_id: z.string().uuid(),
  starts_on: z.iso.date(),
  notes: z.string().max(1000).nullable().optional(),
})

export const endAssignmentSchema = z.object({
  assignment_id: z.string().uuid(),
  ends_on: z.iso.date(),
})

export const swapResidentsSchema = z.object({
  assignment_id_a: z.string().uuid(),
  assignment_id_b: z.string().uuid(),
})
