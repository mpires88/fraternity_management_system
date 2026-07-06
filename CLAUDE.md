# Project context

This is the Chapter Management Platform.

- **`docs/PLAN.md` is the active implementation plan — read it before making changes.**
- `docs/SPEC.md` is the long-term product vision, NOT the build order. Where they
  conflict, PLAN.md wins.
- Schema ground truth is the generated `lib/supabase/types.ts`.

## Stack
- Next.js 16 (App Router) + React 19
- Supabase (database, auth, storage)
- Tailwind CSS v4 + shadcn/ui
- TypeScript (typecheck via tsgo), Biome (lint + format), Vitest

## Commands
- `npm run check` — Biome + typecheck + tests. Must pass before a task is done.
- After any schema change: `supabase db push`, then `npm run types:db`

## Tenancy model (v3 — frozen, do not redesign)

```
parent_organizations (national, e.g. Sigma Nu)
  └─ organizations (chapter entity, e.g. Epsilon Theta)
       └─ groups (chapter / housing_corp / advisory_board; one is_primary)
            └─ group_memberships (person + role_type_id + status_id)
```

- `persons` are platform-level (one row per auth user, never deleted) and can belong
  to many groups with different roles.
- Feature tables hang off `group_id`. Keep every feature group-generic — never key
  behavior on `group_type === 'chapter'`.
- URL shape: `/[parent]/[org]/[group]/[feature]`.
- Cross-group links live in `group_relationships` (e.g. housing corp oversees chapter).

## Key rules
- Always use `term_id` — never semester + year
- Always use `role_type_id` (what you are) + `status_id` (current standing) — never
  hardcoded role names. (`membership_type_id` is dead; if you see it, it's stale code.)
- A person can hold multiple active roles per group; effective permissions are the
  most permissive active role, restricted by status overrides
  (`lib/utils/permissions.ts` — unit-tested, don't reimplement)

---

## Architecture

Three-layer separation — never skip layers:

```
actions/   →   lib/ (pure logic)   →   dal/ (DB only)
```

### Actions (`actions/**/*.action.ts`)
- Use helpers from `@/actions/utils/action-helpers` (see table below)
- Always return `ActionResult<T>` — never `T | null`
- Never call Supabase directly — call DAL functions
- Don't add try/catch — the core engine handles it
- Validate input with Zod schemas from `lib/validations/`

```ts
// Pattern
export const updateMember = createOrgAuthenticatedAction(
  async (supabase, user, groupId, input: UpdateInput) =>
    updateMemberDal(supabase, groupId, input),
  { revalidatePaths: ['/members'] }
)
```

### DAL (`dal/**/*.ts`)
- Only place that touches the database
- First param is always `supabase: DbClient`
- Return `DalResult<T>` or `MutationResult<T>`

```ts
// Pattern
export async function getMembersDal(
  supabase: DbClient,
  groupId: string
): Promise<Member[]> {
  const { data } = await supabase.from('group_memberships')
    .select('*, persons(*)')
    .eq('group_id', groupId)
  return data ?? []
}
```

### Lib (`lib/**/*.ts`)
- Pure business logic, no DB access
- Permission resolution, term date math, audience expansion, etc.

---

## Auth, org context & RLS — how it actually works

- Session: `@supabase/ssr` cookies; `middleware.ts` refreshes the session and
  redirects unauthenticated users to `/login` (login itself goes through
  `POST /api/auth/login`).
- **Database security is `auth.uid()`-based RLS**, via SECURITY DEFINER helpers:
  - `get_my_group_ids()` — groups where I have an active, non-expelled membership
  - `get_my_organization_ids()` — same at organization level
  - Never query `group_memberships` directly inside a policy (causes RLS recursion).
  - `get_my_org_ids()` is a deprecated back-compat alias — don't use in new policies.
- The `currentOrgId` cookie (set on group navigation, injected as an `x-org-id`
  header by `lib/supabase/server.ts`) is **app-level UX state only — no RLS policy
  reads it**. Do not treat it as a security boundary.
- Group context for pages comes from `getGroupContext` (`dal/group-context.ts`) via
  the `[group]/layout.tsx` → `OrgProvider` → `useOrg()` chain.
- Management UI is gated on `access_level === 'full'` (see `admin/page.tsx`).

---

## Action Helper Reference

| Helper | When to use |
|--------|-------------|
| `createAuthenticatedAction` | Mutation with input, no org context |
| `createNoInputAuthenticatedAction` | Mutation without input |
| `createAuthenticatedQueryAction` | Query with input (null → error) |
| `createNoInputQueryAction` | Query without input (null → error) |
| `createValidatedAction` | Mutation with Zod validation |
| `createOrgAuthenticatedAction` | Org-scoped mutation with input |
| `createNoInputOrgAuthenticatedAction` | Org-scoped mutation without input |
| `createOrgQueryAction` | Org-scoped query with input |
| `createNoInputOrgQueryAction` | Org-scoped query without input |
| `createValidatedOrgAction` | Org-scoped mutation with Zod validation |
| `createOptionalAuthAction` | Auth optional (e.g. voting) |

Note: "org-scoped" helpers scope to the current **group** (the cookie stores a group
id — the "org" naming predates the v3 groups layer).

---

## File & Naming Conventions
- Files: `kebab-case.ts`; Components: `PascalCase.tsx`; Actions: `*.action.ts`
- Migrations: `YYYYMMDD_NNNNNN_descriptive_name.sql`
  (e.g. `20260405000001_add_requirements.sql`)
- RLS policies: `table_name_select`, `table_name_insert`, `table_name_update`,
  `table_name_delete`
- `@/*` maps to project root
- Schema reference: `supabase/schema-reference.sql` — regenerate after schema changes
  (`supabase db dump --schema public`); if it disagrees with `lib/supabase/types.ts`,
  types.ts wins

## What NOT to do
- Don't call Supabase in page components or components — use actions/DAL
- Don't hardcode role names — use `role_type_id` / `status_id`
- Don't use `semester + year` — use `term_id`
- Don't return `T | null` from actions — use `ActionResult<T>`
- Don't add try/catch in actions — the core engine handles it
- Don't key behavior on a specific group type — features must work for the chapter
  and the housing corp alike
- Don't build parked SPEC.md features (elections, rush, budgets, house, …) unless
  PLAN.md or the user says so
