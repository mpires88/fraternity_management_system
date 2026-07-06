/**
 * Action Core Engine
 *
 * Single implementation of the auth → execute → revalidate → return pattern.
 * All public action helpers delegate here.
 *
 * NOT exported publicly — consumers use the named helpers in action-helpers.ts.
 */

import type { User } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import type { DbClient } from '@/dal/types'
import { DalError, UserFacingError } from '@/lib/errors'
import { logger } from '@/lib/logging'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types/actions'

const log = logger.child({ feature: 'action-core' })

export { DalError, UserFacingError } from '@/lib/errors'

// ============================================================================
// Context Types
// ============================================================================

export interface ActionContext {
  supabase: DbClient
  user: User
  groupId?: string
}

export interface OptionalAuthContext {
  supabase: DbClient
  user: User | null
}

// ============================================================================
// Config
// ============================================================================

export interface ActionConfig {
  /** Auto-extract org context from cookie and inject into Supabase header */
  withOrgContext?: boolean
  /** Zod schema for input validation (runs before auth) */
  schema?: z.ZodSchema
  /** Convert null handler result to this error message */
  nullError?: string
  /** Paths to revalidate on success */
  revalidatePaths?: string[]
}

// ============================================================================
// Internal Helpers
// ============================================================================

class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

function validateInput<TInput>(schema: z.ZodSchema, rawInput: TInput): ActionResult<TInput> {
  const parsed = schema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  return { success: true, data: parsed.data as TInput }
}

function doRevalidate(paths: string[] | undefined): void {
  if (!paths) return
  for (const path of paths) revalidatePath(path)
}

function handleError<T>(error: unknown): ActionResult<T> {
  // Let Next.js dynamic-rendering bailouts propagate.
  if (error instanceof Error && error.message.startsWith('Dynamic server usage:')) {
    throw error
  }
  if (error instanceof AuthError) {
    return { success: false, error: error.message }
  }
  if (error instanceof UserFacingError) {
    return { success: false, error: error.message }
  }
  if (error instanceof DalError) {
    log.error(error, { code: error.code, ...error.context })
    return { success: false, error: error.userMessage }
  }
  // Log raw error server-side; never forward internal details to client.
  log.error(error)
  return { success: false, error: 'Operation failed' }
}

function buildResult<T>(data: T, nullError?: string): ActionResult<T> {
  if (nullError && data == null) {
    return { success: false, error: nullError }
  }
  return { success: true, data }
}

// ============================================================================
// Auth Resolution
// ============================================================================

async function resolveAuth(config: ActionConfig): Promise<ActionContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new AuthError('Not authenticated')

  let groupId: string | undefined
  if (config.withOrgContext) {
    const { getCurrentOrgId } = await import('@/lib/auth/org-context')
    groupId = (await getCurrentOrgId(supabase)) ?? undefined
    if (!groupId) throw new AuthError('No organization selected')
  }

  return { supabase, user, groupId }
}

async function resolveOptionalAuth(): Promise<OptionalAuthContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

// ============================================================================
// Core Executors
// ============================================================================

/** Action WITH input */
export function executeAction<TInput, TOutput>(
  config: ActionConfig,
  handler: (ctx: ActionContext, input: TInput) => Promise<TOutput>
) {
  return async (rawInput: TInput): Promise<ActionResult<TOutput>> => {
    let input = rawInput
    if (config.schema) {
      const validated = validateInput(config.schema, rawInput)
      if (!validated.success) return { success: false, error: validated.error }
      input = validated.data!
    }

    try {
      const ctx = await resolveAuth(config)
      const data = await handler(ctx, input)
      doRevalidate(config.revalidatePaths)
      return buildResult(data, config.nullError)
    } catch (error) {
      return handleError<TOutput>(error)
    }
  }
}

/** Action WITHOUT input */
export function executeNoInputAction<TOutput>(
  config: ActionConfig,
  handler: (ctx: ActionContext) => Promise<TOutput>
) {
  return async (): Promise<ActionResult<TOutput>> => {
    try {
      const ctx = await resolveAuth(config)
      const data = await handler(ctx)
      doRevalidate(config.revalidatePaths)
      return buildResult(data, config.nullError)
    } catch (error) {
      return handleError<TOutput>(error)
    }
  }
}

/** Optional-auth action WITH input (user may be null) */
export function executeOptionalAuthAction<TInput, TOutput>(
  config: Pick<ActionConfig, 'schema' | 'nullError' | 'revalidatePaths'>,
  handler: (ctx: OptionalAuthContext, input: TInput) => Promise<TOutput>
) {
  return async (rawInput: TInput): Promise<ActionResult<TOutput>> => {
    let input = rawInput
    if (config.schema) {
      const validated = validateInput(config.schema, rawInput)
      if (!validated.success) return { success: false, error: validated.error }
      input = validated.data!
    }

    try {
      const ctx = await resolveOptionalAuth()
      const data = await handler(ctx, input)
      doRevalidate(config.revalidatePaths)
      return buildResult(data, config.nullError)
    } catch (error) {
      return handleError<TOutput>(error)
    }
  }
}

/** Optional-auth action WITHOUT input */
export function executeNoInputOptionalAuthAction<TOutput>(
  config: Pick<ActionConfig, 'nullError' | 'revalidatePaths'>,
  handler: (ctx: OptionalAuthContext) => Promise<TOutput>
) {
  return async (): Promise<ActionResult<TOutput>> => {
    try {
      const ctx = await resolveOptionalAuth()
      const data = await handler(ctx)
      doRevalidate(config.revalidatePaths)
      return buildResult(data, config.nullError)
    } catch (error) {
      return handleError<TOutput>(error)
    }
  }
}
