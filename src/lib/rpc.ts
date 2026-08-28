/**
 * Typed wrapper for Supabase RPC calls.
 *
 * The hand-crafted Database type in types.ts does not perfectly align with
 * the generic constraints of @supabase/supabase-js v2.x `rpc()`.
 * This thin wrapper bridges the gap while preserving full type safety at
 * the call-site, following the same pattern already used in
 * SubmitFeedback.tsx (line 235-249).
 *
 * An admin table-write helper provides a narrowly typed adapter for
 * cluster status updates without weakening the Supabase client globally.
 */
import { supabase } from './supabase'
import type {
  Database,
  IssueCluster,
  ClusterStatus,
} from './types'

type Schema = Database['public']
type FnName = keyof Schema['Functions']

/**
 * Call a Supabase RPC with full type inference for Args and Returns.
 *
 * Usage:
 * ```ts
 * const { data, error } = await callRpc('teacher_acknowledge_cluster', { p_cluster_id: id })
 * ```
 */
export async function callRpc<
  Fn extends FnName,
  Args extends Schema['Functions'][Fn]['Args'],
  Returns extends Schema['Functions'][Fn]['Returns'],
>(fn: Fn, args: Args): Promise<{ data: Returns | null; error: { message: string } | null }> {
  const result = await (
    supabase.rpc as unknown as (
      name: Fn,
      rpcArgs: Args,
    ) => Promise<{ data: Returns | null; error: { message: string } | null }>
  )(fn, args)
  return result
}

/**
 * Call a Supabase RPC that takes no arguments.
 */
export async function callRpcNoArgs<
  Fn extends FnName,
  Returns extends Schema['Functions'][Fn]['Returns'],
>(fn: Fn): Promise<{ data: Returns | null; error: { message: string } | null }> {
  const result = await (
    supabase.rpc as unknown as (
      name: Fn,
    ) => Promise<{ data: Returns | null; error: { message: string } | null }>
  )(fn)
  return result
}

// ---------------------------------------------------------------------------
// Error sanitiser
// ---------------------------------------------------------------------------

/** Internal database-error patterns that must never reach the UI. */
const SENSITIVE_PATTERNS = [
  /duplicate key/i,
  /violates (?:foreign key|check|not-null) constraint/i,
  /relation "/i,
  /column "/i,
  /schema "/i,
  /permission denied/i,
  /row-level security/i,
  /SQLSTATE/i,
  /stack trace/i,
]

/**
 * Convert a raw Supabase / PostgREST error into a safe user-facing message.
 * If the original message contains internal database detail, a generic
 * message is returned instead.
 */
export function friendlyError(raw: string | undefined | null): string {
  if (!raw) return 'An unexpected error occurred. Please try again.'
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(raw)) {
      return 'An unexpected error occurred. Please try again.'
    }
  }
  return raw
}

// ---------------------------------------------------------------------------
// Admin table-write adapter (narrowly typed, no global client weakening)
// ---------------------------------------------------------------------------

/**
 * Update an issue cluster's status (admin only — enforced by RLS).
 * Valid values: 'open' | 'acknowledged' | 'action_created' | 'closed'.
 */
export async function updateClusterStatus(
  clusterId: string,
  status: ClusterStatus,
): Promise<{ error: { message: string } | null }> {
  // The cast is scoped to this single call; the public signature is fully typed.
  const qb = supabase.from('issue_clusters') as unknown as {
    update: (values: Partial<Pick<IssueCluster, 'status'>>) => {
      eq: (col: 'id', val: string) => Promise<{ error: { message: string } | null }>
    }
  }
  return qb.update({ status }).eq('id', clusterId)
}
