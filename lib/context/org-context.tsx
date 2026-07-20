'use client'

import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext } from 'react'
import type { Group } from '@/dal/group-context'
import type {
  EffectivePermissions,
  ModuleRoles,
  Org,
  OrgMembership,
  Person,
  RoleType,
  StatusDefinition,
} from '@/lib/types/db'
import { canManageModule, getEffectivePermissions, mergePermissions } from '@/lib/utils/permissions'

export type ParentOrgInfo = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
}

export type ActiveRole = {
  membership: OrgMembership
  roleType: RoleType
  statusDefinition: StatusDefinition
}

export type OrgContextValue = {
  parentOrg: ParentOrgInfo | null
  org: Org
  group: Group
  person: Person
  roles: ActiveRole[]
  roleType: RoleType
  statusDefinition: StatusDefinition
  membership: OrgMembership
  /** @deprecated Use roleType */
  membershipType: RoleType
  permissions: EffectivePermissions
  allGroups: Array<{ group: Group; parentSlug: string | null; orgSlug: string }>
  moduleRoles: ModuleRoles
  canManage: (module: keyof ModuleRoles) => boolean
  switchGroup: (groupSlug: string, orgSlug?: string, parentSlug?: string) => void
  isPlatformAdmin: boolean
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({
  value,
  children,
}: {
  value: Omit<
    OrgContextValue,
    | 'permissions'
    | 'canManage'
    | 'switchGroup'
    | 'membershipType'
    | 'roleType'
    | 'statusDefinition'
    | 'membership'
  >
  children: React.ReactNode
}) {
  const router = useRouter()

  const permSets = value.roles.map((r) => getEffectivePermissions(r.roleType, r.statusDefinition))
  const permissions = mergePermissions(permSets)

  const primary = value.roles[0]

  const canManage = useCallback(
    (module: keyof ModuleRoles) =>
      canManageModule(module, permissions.access_level, value.moduleRoles),
    [permissions.access_level, value.moduleRoles]
  )

  const switchGroup = useCallback(
    (groupSlug: string, orgSlug?: string, parentSlug?: string) => {
      const oSlug = orgSlug ?? value.org.slug
      const pSlug = parentSlug ?? value.parentOrg?.slug
      const path = pSlug
        ? `/${pSlug}/${oSlug}/${groupSlug}/dashboard`
        : `/${oSlug}/${oSlug}/${groupSlug}/dashboard`
      router.push(path)
    },
    [router, value.org.slug, value.parentOrg?.slug]
  )

  return (
    <OrgContext.Provider
      value={{
        ...value,
        membership: primary.membership,
        roleType: primary.roleType,
        statusDefinition: primary.statusDefinition,
        membershipType: primary.roleType,
        permissions,
        canManage,
        switchGroup,
      }}
    >
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider')
  return ctx
}
