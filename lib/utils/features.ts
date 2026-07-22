import type { OrgFeatures } from '@/lib/types/db'

/**
 * Checks whether a feature is enabled. Features are stored per-GROUP (the
 * chapter, housing corp, and alumni chapter under one org enable different
 * modules), so pass a group's `features` jsonb. Defaults to false when unset.
 */
export function isEnabled(
  source: { features?: Record<string, boolean> | Partial<OrgFeatures> | null },
  feature: keyof OrgFeatures
): boolean {
  return (source.features as Record<string, boolean> | null | undefined)?.[feature] === true
}
