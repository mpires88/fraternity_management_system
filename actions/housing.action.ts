'use server'

import { createValidatedOrgAction } from '@/actions/utils/action-helpers'
import {
  assignRoomDal,
  endAssignmentDal,
  isActiveGroupMemberDal,
  swapResidentsDal,
  termBelongsToGroupDal,
} from '@/dal/housing'
import type { DbClient } from '@/dal/types'
import { UserFacingError } from '@/lib/errors'
import {
  assignRoomSchema,
  endAssignmentSchema,
  swapResidentsSchema,
} from '@/lib/validations/housing'

/**
 * Room writes are RLS-gated on the managing group's house manager; this
 * check exists to give a clear denial instead of a raw policy error.
 */
async function assertHouseManager(supabase: DbClient, groupId: string): Promise<void> {
  const { data } = await supabase.rpc('get_my_module_admin_group_ids', {
    p_module: 'house_manager',
  })
  if (!((data as string[] | null) ?? []).includes(groupId)) {
    throw new UserFacingError('Only a house manager can do this')
  }
}

// ── Assign room ────────────────────────────────────────────────────────────

export const assignRoom = createValidatedOrgAction(
  assignRoomSchema,
  async (supabase, _actor, groupId, input) => {
    await assertHouseManager(supabase, groupId)

    // Bind the assignment to this group's world: RLS only checks the room,
    // so without these a typo'd uuid could assign any platform person or a
    // foreign group's term
    if (!(await isActiveGroupMemberDal(supabase, groupId, input.member_id)))
      throw new UserFacingError('That person is not an active member of this group')
    if (!(await termBelongsToGroupDal(supabase, groupId, input.term_id)))
      throw new UserFacingError('That term does not belong to this group')

    const result = await assignRoomDal(supabase, input)
    if (!result.success) throw new UserFacingError(result.error ?? 'Assignment failed')
    return result.data
  },
  { revalidatePaths: ['/housing'] }
)

// ── End assignment ─────────────────────────────────────────────────────────

export const endAssignment = createValidatedOrgAction(
  endAssignmentSchema,
  async (supabase, _actor, groupId, input) => {
    await assertHouseManager(supabase, groupId)
    const result = await endAssignmentDal(supabase, input.assignment_id, input.ends_on)
    if (!result.success) throw new UserFacingError(result.error ?? 'End assignment failed')
  },
  { revalidatePaths: ['/housing'] }
)

// ── Swap residents ─────────────────────────────────────────────────────────

export const swapResidents = createValidatedOrgAction(
  swapResidentsSchema,
  async (supabase, _actor, groupId, input) => {
    await assertHouseManager(supabase, groupId)
    const result = await swapResidentsDal(supabase, input.assignment_id_a, input.assignment_id_b)
    if (!result.success) throw new UserFacingError(result.error ?? 'Swap failed')
  },
  { revalidatePaths: ['/housing'] }
)
