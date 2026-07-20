import type { GroupContextData } from '@/dal/group-context'
import type { EffectivePermissions, ModuleRoles } from '@/lib/types/db'
import { canManageModule, getEffectivePermissions, mergePermissions } from '@/lib/utils/permissions'

/**
 * Resolves merged permissions from GroupContextData (server-side).
 */
export function resolvePermissionsFromContext(ctx: GroupContextData): EffectivePermissions {
  const permSets = ctx.roles.map((r) => getEffectivePermissions(r.roleType, r.statusDefinition))
  return mergePermissions(permSets)
}

/**
 * Server-side twin of the client's ctx.canManage(module): full access or the
 * matching module position (rush chair / treasurer / house manager).
 */
export function canManageFromContext(ctx: GroupContextData, module: keyof ModuleRoles): boolean {
  const perms = resolvePermissionsFromContext(ctx)
  return canManageModule(module, perms.access_level, ctx.moduleRoles)
}
