/**
 * App URLs are always group-scoped: /[parent]/[org]/[group]/<feature>.
 * Notifications and emails must store the full path — a bare '/requirements'
 * has no route and 404s.
 */

export interface GroupSlugPath {
  parentSlug: string
  orgSlug: string
  groupSlug: string
}

export function buildGroupHref(path: GroupSlugPath, featurePath: string): string {
  const feature = featurePath.startsWith('/') ? featurePath : `/${featurePath}`
  return `/${path.parentSlug}/${path.orgSlug}/${path.groupSlug}${feature}`
}
