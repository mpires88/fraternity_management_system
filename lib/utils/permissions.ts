import type { EffectivePermissions, ModuleRoles } from '@/lib/types/db'

/**
 * Permission fields shared by role types and status overrides.
 */
type PermissionSource = {
  access_level: string
  can_vote: boolean
  can_hold_office: boolean
  can_attend_events: boolean
  can_view_roster: boolean
  can_view_financials: boolean
  can_submit_expenses: boolean
  can_view_minutes: boolean
  can_speak_at_meetings: boolean
  can_view_documents: boolean
}

type StatusOverrides = {
  override_access_level: string | null
  override_can_vote: boolean | null
  override_can_hold_office: boolean | null
  override_can_attend_events: boolean | null
  override_can_view_roster: boolean | null
  override_can_view_financials: boolean | null
  override_can_submit_expenses: boolean | null
  override_can_view_minutes: boolean | null
  override_can_speak_at_meetings: boolean | null
  override_can_view_documents: boolean | null
}

const ACCESS_RANK: Record<string, number> = { full: 3, limited: 2, read_only: 1, none: 0 }

/**
 * Resolves effective permissions for a single role + status.
 *
 * Starts with role base permissions, applies status overrides.
 * Status can only restrict — never grant more than the role allows.
 */
export function getEffectivePermissions(
  role: PermissionSource,
  statusOverrides?: StatusOverrides | null
): EffectivePermissions {
  if (!statusOverrides) {
    return {
      access_level: role.access_level as EffectivePermissions['access_level'],
      can_vote: role.can_vote,
      can_hold_office: role.can_hold_office,
      can_attend_events: role.can_attend_events,
      can_view_roster: role.can_view_roster,
      can_view_financials: role.can_view_financials,
      can_submit_expenses: role.can_submit_expenses,
      can_view_minutes: role.can_view_minutes,
      can_speak_at_meetings: role.can_speak_at_meetings,
      can_view_documents: role.can_view_documents,
    }
  }

  const applyBool = (base: boolean, override: boolean | null): boolean => {
    if (override === null) return base
    if (override === false) return false
    return base
  }

  const applyAccess = (
    base: string,
    override: string | null
  ): EffectivePermissions['access_level'] => {
    if (!override) return base as EffectivePermissions['access_level']
    const baseRank = ACCESS_RANK[base] ?? 3
    const overrideRank = ACCESS_RANK[override] ?? 3
    const effective = overrideRank < baseRank ? override : base
    return effective as EffectivePermissions['access_level']
  }

  return {
    access_level: applyAccess(role.access_level, statusOverrides.override_access_level),
    can_vote: applyBool(role.can_vote, statusOverrides.override_can_vote),
    can_hold_office: applyBool(role.can_hold_office, statusOverrides.override_can_hold_office),
    can_attend_events: applyBool(
      role.can_attend_events,
      statusOverrides.override_can_attend_events
    ),
    can_view_roster: applyBool(role.can_view_roster, statusOverrides.override_can_view_roster),
    can_view_financials: applyBool(
      role.can_view_financials,
      statusOverrides.override_can_view_financials
    ),
    can_submit_expenses: applyBool(
      role.can_submit_expenses,
      statusOverrides.override_can_submit_expenses
    ),
    can_view_minutes: applyBool(role.can_view_minutes, statusOverrides.override_can_view_minutes),
    can_speak_at_meetings: applyBool(
      role.can_speak_at_meetings,
      statusOverrides.override_can_speak_at_meetings
    ),
    can_view_documents: applyBool(
      role.can_view_documents,
      statusOverrides.override_can_view_documents
    ),
  }
}

/**
 * Resolves module-level management roles from a person's active position
 * assignments. Each assignment links to a position whose system_position_role
 * carries boolean flags. Any true flag grants the module role.
 */
export function resolveModuleRoles(
  systemRoleFlags: Array<{
    is_rush_chair: boolean
    is_treasurer: boolean
    is_house_manager: boolean
  }>
): ModuleRoles {
  const roles: ModuleRoles = { rush: false, treasurer: false, houseManager: false }
  for (const flags of systemRoleFlags) {
    if (flags.is_rush_chair) roles.rush = true
    if (flags.is_treasurer) roles.treasurer = true
    if (flags.is_house_manager) roles.houseManager = true
  }
  return roles
}

/**
 * Whether the user can manage a given module: full admin access OR holds
 * a position with the module's system role flag.
 */
export function canManageModule(
  module: keyof ModuleRoles,
  accessLevel: string,
  moduleRoles: ModuleRoles
): boolean {
  return accessLevel === 'full' || moduleRoles[module]
}

/**
 * Merges permissions from multiple active roles.
 * Takes the MOST permissive value for each field (union of all roles).
 *
 * Example: Member (Alumni Brother status, read_only) + Advisor (Active, limited)
 * Result: limited access (highest of the two), can_view_financials=true (Advisor grants it)
 */
export function mergePermissions(permSets: EffectivePermissions[]): EffectivePermissions {
  if (permSets.length === 0) {
    return {
      access_level: 'none',
      can_vote: false,
      can_hold_office: false,
      can_attend_events: false,
      can_view_roster: false,
      can_view_financials: false,
      can_submit_expenses: false,
      can_view_minutes: false,
      can_speak_at_meetings: false,
      can_view_documents: false,
    }
  }

  if (permSets.length === 1) return permSets[0]

  // Most permissive access level wins
  let bestAccess: EffectivePermissions['access_level'] = 'none'
  for (const p of permSets) {
    const pRank = ACCESS_RANK[p.access_level] ?? 0
    const bestRank = ACCESS_RANK[bestAccess] ?? 0
    if (pRank > bestRank) bestAccess = p.access_level
  }

  return {
    access_level: bestAccess,
    can_vote: permSets.some((p) => p.can_vote),
    can_hold_office: permSets.some((p) => p.can_hold_office),
    can_attend_events: permSets.some((p) => p.can_attend_events),
    can_view_roster: permSets.some((p) => p.can_view_roster),
    can_view_financials: permSets.some((p) => p.can_view_financials),
    can_submit_expenses: permSets.some((p) => p.can_submit_expenses),
    can_view_minutes: permSets.some((p) => p.can_view_minutes),
    can_speak_at_meetings: permSets.some((p) => p.can_speak_at_meetings),
    can_view_documents: permSets.some((p) => p.can_view_documents),
  }
}
