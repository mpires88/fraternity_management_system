/**
 * Structured error handling for the application.
 *
 * UserFacingError — message is safe to show to the client as-is.
 * DalError — structured error with code, context, and DB error wrapping.
 */

// ── Error Codes ──────────────────────────────────────────────────────────────

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_RECORD'
  | 'FOREIGN_KEY_VIOLATION'
  | 'RLS_VIOLATION'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR'

// ── UserFacingError ──────────────────────────────────────────────────────────

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}

// ── DalError ─────────────────────────────────────────────────────────────────

export class DalError extends Error {
  readonly code: ErrorCode
  readonly userMessage: string
  readonly technicalDetails?: string
  readonly context?: Record<string, unknown>

  constructor(opts: {
    code: ErrorCode
    userMessage: string
    technicalDetails?: string
    context?: Record<string, unknown>
    cause?: unknown
  }) {
    super(opts.userMessage)
    this.name = 'DalError'
    this.code = opts.code
    this.userMessage = opts.userMessage
    this.technicalDetails = opts.technicalDetails
    this.context = opts.context
    if (opts.cause) this.cause = opts.cause
  }
}

// ── Database Error Wrapping ──────────────────────────────────────────────────

const PG_CODES: Record<string, { code: ErrorCode; message: string }> = {
  '23505': { code: 'DUPLICATE_RECORD', message: 'This record already exists' },
  '23503': { code: 'FOREIGN_KEY_VIOLATION', message: 'Referenced record not found' },
  '42501': { code: 'RLS_VIOLATION', message: 'You do not have permission to perform this action' },
  '42P01': { code: 'DATABASE_ERROR', message: 'Operation failed' },
}

/**
 * Wraps a Supabase/Postgres error into a DalError with a user-friendly message.
 * Use in DAL functions after a query fails.
 */
export function wrapDatabaseError(
  error: { message: string; code?: string; details?: string; hint?: string },
  context?: Record<string, unknown>
): DalError {
  const pgMapping = error.code ? PG_CODES[error.code] : undefined

  if (pgMapping) {
    return new DalError({
      code: pgMapping.code,
      userMessage: pgMapping.message,
      technicalDetails: `${error.message} [${error.code}]${error.details ? ` — ${error.details}` : ''}`,
      context,
      cause: error,
    })
  }

  // Check for common Supabase error patterns
  if (error.message.includes('JWT')) {
    return new DalError({
      code: 'UNAUTHORIZED',
      userMessage: 'Your session has expired. Please sign in again.',
      technicalDetails: error.message,
      context,
      cause: error,
    })
  }

  return new DalError({
    code: 'DATABASE_ERROR',
    userMessage: 'Operation failed',
    technicalDetails: error.message,
    context,
    cause: error,
  })
}
