/**
 * Cluster evidence and share helpers.
 *
 * Evidence quotes and feedback shares are derived only from real cluster
 * membership (cluster_feedback, or cluster_feedback_for_teacher for
 * teachers), never from topic or category matching.  Counts, quotes and
 * shares therefore always describe the same set of linked submissions.
 */

export interface ClusterMembershipRow {
  cluster_id: string
  feedback_id: string
}

/** Group membership rows by cluster ID, de-duplicating feedback IDs. */
export function buildClusterMembership(
  rows: readonly ClusterMembershipRow[],
): Map<string, Set<string>> {
  const membership = new Map<string, Set<string>>()
  for (const row of rows) {
    const members = membership.get(row.cluster_id) ?? new Set<string>()
    members.add(row.feedback_id)
    membership.set(row.cluster_id, members)
  }
  return membership
}

/** Feedback rows actually linked to the cluster and visible to the viewer. */
export function linkedClusterFeedback<T extends { id: string }>(
  clusterId: string,
  membership: Map<string, Set<string>>,
  feedbacks: readonly T[],
): T[] {
  const members = membership.get(clusterId)
  if (!members || members.size === 0) return []
  return feedbacks.filter((feedback) => members.has(feedback.id))
}

/**
 * Whole-number percentage of the viewer's feedback that is linked to the
 * cluster.  Pass the length of linkedClusterFeedback() as the numerator so it
 * is a subset of the denominator.  Returns null with no feedback.
 */
export function clusterSharePercent(linkedVisibleCount: number, visibleTotal: number): number | null {
  if (visibleTotal <= 0) return null
  return Math.round((linkedVisibleCount / visibleTotal) * 100)
}
