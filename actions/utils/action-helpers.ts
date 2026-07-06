/**
 * Action Helpers — public API for creating server actions.
 *
 * Usage pattern:
 *
 *   // Mutation with input
 *   export const updateMember = createAuthenticatedAction(
 *     async (supabase, user, input: UpdateInput) =>
 *       updateMemberDal(supabase, input),
 *     { revalidatePaths: ['/members'] }
 *   )
 *
 *   // Org-scoped query
 *   export const getMembers = createNoInputOrgQueryAction(
 *     async (supabase, user, groupId) => getMembersDal(supabase, groupId),
 *     'Members not found'
 *   )
 */

import type { User } from '@supabase/supabase-js'
import type { z } from 'zod'
import {
  executeAction,
  executeNoInputAction,
  executeNoInputOptionalAuthAction,
  executeOptionalAuthAction,
} from '@/actions/utils/action-core'
import type { DbClient } from '@/dal/types'
import type { ActionResult } from '@/types/actions'

export { UserFacingError } from '@/lib/errors'

// ============================================================================
// Handler Type Aliases
// ============================================================================

type AuthHandler<TIn, TOut> = (supabase: DbClient, user: User, input: TIn) => Promise<TOut>
type NoInputAuthHandler<TOut> = (supabase: DbClient, user: User) => Promise<TOut>
type OrgHandler<TIn, TOut> = (
  supabase: DbClient,
  user: User,
  groupId: string,
  input: TIn
) => Promise<TOut>
type NoInputOrgHandler<TOut> = (supabase: DbClient, user: User, groupId: string) => Promise<TOut>
type OptionalAuthHandler<TIn, TOut> = (
  supabase: DbClient,
  user: User | null,
  input: TIn
) => Promise<TOut>
type NoInputOptionalAuthHandler<TOut> = (supabase: DbClient, user: User | null) => Promise<TOut>

type Options = { revalidatePaths?: string[] }

// ============================================================================
// Authenticated — with input
// ============================================================================

export function createAuthenticatedAction<TIn, TOut>(
  handler: AuthHandler<TIn, TOut>,
  options?: Options
): (input: TIn) => Promise<ActionResult<TOut>> {
  return executeAction<TIn, TOut>({ revalidatePaths: options?.revalidatePaths }, (ctx, input) =>
    handler(ctx.supabase, ctx.user, input)
  )
}

export function createAuthenticatedQueryAction<TIn, TOut>(
  handler: AuthHandler<TIn, TOut | null>,
  notFoundMessage = 'Not found'
): (input: TIn) => Promise<ActionResult<TOut>> {
  return executeAction<TIn, TOut>(
    { nullError: notFoundMessage },
    (ctx, input) => handler(ctx.supabase, ctx.user, input) as Promise<TOut>
  )
}

export function createValidatedAction<TSchema extends z.ZodSchema, TOut>(
  schema: TSchema,
  handler: AuthHandler<z.infer<TSchema>, TOut>,
  options?: Options
): (input: unknown) => Promise<ActionResult<TOut>> {
  return executeAction<unknown, TOut>(
    { schema, revalidatePaths: options?.revalidatePaths },
    (ctx, input) => handler(ctx.supabase, ctx.user, input as z.infer<TSchema>)
  )
}

// ============================================================================
// Authenticated — no input
// ============================================================================

export function createNoInputAuthenticatedAction<TOut>(
  handler: NoInputAuthHandler<TOut>,
  options?: Options
): () => Promise<ActionResult<TOut>> {
  return executeNoInputAction<TOut>({ revalidatePaths: options?.revalidatePaths }, (ctx) =>
    handler(ctx.supabase, ctx.user)
  )
}

export function createNoInputQueryAction<TOut>(
  handler: NoInputAuthHandler<TOut | null>,
  notFoundMessage = 'Not found'
): () => Promise<ActionResult<TOut>> {
  return executeNoInputAction<TOut>(
    { nullError: notFoundMessage },
    (ctx) => handler(ctx.supabase, ctx.user) as Promise<TOut>
  )
}

// ============================================================================
// Org-scoped — with input
// ============================================================================

export function createOrgAuthenticatedAction<TIn, TOut>(
  handler: OrgHandler<TIn, TOut>,
  options?: Options
): (input: TIn) => Promise<ActionResult<TOut>> {
  return executeAction<TIn, TOut>(
    { withOrgContext: true, revalidatePaths: options?.revalidatePaths },
    (ctx, input) => handler(ctx.supabase, ctx.user, ctx.groupId!, input)
  )
}

export function createOrgQueryAction<TIn, TOut>(
  handler: OrgHandler<TIn, TOut | null>,
  notFoundMessage = 'Not found'
): (input: TIn) => Promise<ActionResult<TOut>> {
  return executeAction<TIn, TOut>(
    { withOrgContext: true, nullError: notFoundMessage },
    (ctx, input) => handler(ctx.supabase, ctx.user, ctx.groupId!, input) as Promise<TOut>
  )
}

export function createValidatedOrgAction<TSchema extends z.ZodSchema, TOut>(
  schema: TSchema,
  handler: OrgHandler<z.infer<TSchema>, TOut>,
  options?: Options
): (input: unknown) => Promise<ActionResult<TOut>> {
  return executeAction<unknown, TOut>(
    { schema, withOrgContext: true, revalidatePaths: options?.revalidatePaths },
    (ctx, input) => handler(ctx.supabase, ctx.user, ctx.groupId!, input as z.infer<TSchema>)
  )
}

// ============================================================================
// Org-scoped — no input
// ============================================================================

export function createNoInputOrgAuthenticatedAction<TOut>(
  handler: NoInputOrgHandler<TOut>,
  options?: Options
): () => Promise<ActionResult<TOut>> {
  return executeNoInputAction<TOut>(
    { withOrgContext: true, revalidatePaths: options?.revalidatePaths },
    (ctx) => handler(ctx.supabase, ctx.user, ctx.groupId!)
  )
}

export function createNoInputOrgQueryAction<TOut>(
  handler: NoInputOrgHandler<TOut | null>,
  notFoundMessage = 'Not found'
): () => Promise<ActionResult<TOut>> {
  return executeNoInputAction<TOut>(
    { withOrgContext: true, nullError: notFoundMessage },
    (ctx) => handler(ctx.supabase, ctx.user, ctx.groupId!) as Promise<TOut>
  )
}

// ============================================================================
// Optional Auth (anonymous-capable) — voting, public pages
// ============================================================================

export function createOptionalAuthAction<TIn, TOut>(
  handler: OptionalAuthHandler<TIn, TOut>,
  options?: Options
): (input: TIn) => Promise<ActionResult<TOut>> {
  return executeOptionalAuthAction<TIn, TOut>(
    { revalidatePaths: options?.revalidatePaths },
    (ctx, input) => handler(ctx.supabase, ctx.user, input)
  )
}

export function createNoInputOptionalAuthAction<TOut>(
  handler: NoInputOptionalAuthHandler<TOut>,
  options?: Options
): () => Promise<ActionResult<TOut>> {
  return executeNoInputOptionalAuthAction<TOut>(
    { revalidatePaths: options?.revalidatePaths },
    (ctx) => handler(ctx.supabase, ctx.user)
  )
}

// ============================================================================
// Type guard
// ============================================================================

/**
 * Asserts an ActionResult succeeded. Throws if not.
 * Narrows the type so result.data is guaranteed.
 */
export function assertSuccess<T>(
  result: ActionResult<T>
): asserts result is { success: true; data: T } {
  if (!result.success) {
    throw new Error(result.error ?? 'Operation failed')
  }
  if (result.data === undefined) {
    throw new Error('Expected data but received undefined')
  }
}
