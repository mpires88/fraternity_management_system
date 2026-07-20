/**
 * Centralized labels, colors, and display helpers.
 * Keep enums here instead of inline — < 50 items, static, no FK needed.
 */

// ── Membership Status ────────────────────────────────────────────────────────

export const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  probated: 'Probated',
  suspended: 'Suspended',
  expelled: 'Expelled',
  away: 'Away',
  inactive: 'Inactive',
}

export const MEMBERSHIP_STATUS_COLORS: Record<string, string> = {
  active: 'bg-success/10 text-success',
  probated: 'bg-warning/10 text-warning',
  suspended: 'bg-destructive/10 text-destructive',
  expelled: 'bg-destructive/10 text-destructive',
  away: 'bg-info/10 text-info',
  inactive: 'bg-muted text-muted-foreground',
}

/** Badge variant for shadcn Badge component */
export const MEMBERSHIP_STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  active: 'default',
  probated: 'outline',
  suspended: 'destructive',
  expelled: 'destructive',
  away: 'secondary',
  inactive: 'secondary',
}

// ── Access Levels ────────────────────────────────────────────────────────────

export const ACCESS_LEVEL_LABELS: Record<string, string> = {
  full: 'Full',
  limited: 'Limited',
  read_only: 'Read Only',
  none: 'None',
}

// ── Position Types ───────────────────────────────────────────────────────────

export const POSITION_TYPE_LABELS: Record<string, string> = {
  exec: 'Executive',
  committee: 'Committee',
  house: 'House',
  board: 'Board',
  other: 'Other',
}

// ── Org Types ────────────────────────────────────────────────────────────────

export const ORG_TYPE_LABELS: Record<string, string> = {
  chapter: 'Undergraduate Chapter',
  housing_corp: 'Housing Corporation',
  alumni_chapter: 'Alumni Chapter',
  advisory_board: 'Advisory Board',
  other: 'Other',
}

// ── Relationships ────────────────────────────────────────────────────────────

export const RELATIONSHIP_LABELS: Record<string, string> = {
  parent: 'Parent',
  guardian: 'Guardian',
  spouse: 'Spouse',
  partner: 'Partner',
  sibling: 'Sibling',
  other: 'Other',
}

// ── Subgroup Types ───────────────────────────────────────────────────────────

export const SUBGROUP_TYPE_LABELS: Record<string, string> = {
  committee: 'Committee',
  exec_board: 'Executive Board',
  new_member_class: 'New Member Class',
  house_residents: 'House Residents',
  ad_hoc: 'Ad Hoc',
  family_line: 'Family Line',
  advisory_board: 'Advisory Board',
}

/**
 * Subgroup type label honoring the group's terminology jsonb — Sigma Nu shows
 * "Candidate Class", an NPHC chapter shows "Line", default is the neutral map.
 */
export function getSubgroupTypeLabel(
  type: string,
  terminology?: Record<string, string> | null
): string {
  return terminology?.[type] ?? getLabel(SUBGROUP_TYPE_LABELS, type)
}

// ── Prospect Status (recruitment pipeline) ───────────────────────────────────

export const PROSPECT_STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  offered: 'Offered',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
}

export const PROSPECT_STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  offered: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  declined: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  withdrawn: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400',
}

export const SCHOOL_YEAR_OPTIONS = [
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Graduate',
] as const

// ── Term Status ──────────────────────────────────────────────────────────────

export const TERM_STATUS_LABELS: Record<string, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  completed: 'Completed',
}

export const TERM_STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-info/10 text-info',
  active: 'bg-success/10 text-success',
  completed: 'bg-muted text-muted-foreground',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getLabel(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '—'
  return map[key] ?? key.replace(/_/g, ' ')
}
