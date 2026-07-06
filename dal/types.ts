/**
 * DAL Types
 *
 * Central type definitions for the Data Access Layer.
 * All DAL functions receive DbClient as their first parameter.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export type { Database } from '@/lib/supabase/types'

/** Typed Supabase client — first param of every DAL function. */
export type DbClient = SupabaseClient<Database>

/**
 * Standard result for DAL operations.
 */
export interface DalResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Discriminated union result for DAL mutations.
 * Prefer this for stricter type narrowing.
 */
export type MutationResult<T> = T extends void
  ? { success: true } | { success: false; error: string }
  : { success: true; data: T } | { success: false; error: string }
