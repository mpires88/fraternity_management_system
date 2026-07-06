import type { GroupContextData } from '@/dal/group-context'
import type { EffectivePermissions } from '@/lib/types/db'
import { getEffectivePermissions, mergePermissions } from '@/lib/utils/permissions'

/**
 * Resolves merged permissions from GroupContextData (server-side).
 */
export function resolvePermissionsFromContext(ctx: GroupContextData): EffectivePermissions {
  const permSets = ctx.roles.map((r) => getEffectivePermissions(r.roleType, r.statusDefinition))
  return mergePermissions(permSets)
}
