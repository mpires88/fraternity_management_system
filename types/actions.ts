/**
 * Server Action Result Types
 *
 * All actions return ActionResult<T> for consistent error handling.
 */

export type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
}

/**
 * Used by layout loaders that need to redirect instead of return data.
 */
export type LayoutResult<T> = { success: true; data: T } | { success: false; redirect: string }
