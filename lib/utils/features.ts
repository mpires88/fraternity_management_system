import type { Org, OrgFeatures } from '@/lib/types/db'

/**
 * Checks whether a feature is enabled for an org.
 * All feature flags default to false if not explicitly set.
 */
export function isEnabled(org: Pick<Org, 'features'>, feature: keyof OrgFeatures): boolean {
  return (org.features as Partial<OrgFeatures>)?.[feature] === true
}
