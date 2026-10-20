import { describe, expect, it } from 'vitest'
import {
  buildClusterMembership,
  clusterSharePercent,
  linkedClusterFeedback,
} from '../lib/clusterEvidence'

const FEEDBACKS = [
  { id: 'f1', feedback_area: 'Teaching pace or explanation' },
  { id: 'f2', feedback_area: 'Teaching pace or explanation' },
  { id: 'f3', feedback_area: 'Teaching pace or explanation' },
  { id: 'f4', feedback_area: 'Grading clarity' },
]

describe('cluster evidence', () => {
  const membership = buildClusterMembership([
    { cluster_id: 'c1', feedback_id: 'f1' },
    { cluster_id: 'c1', feedback_id: 'f1' },
    { cluster_id: 'c1', feedback_id: 'f2' },
    { cluster_id: 'c1', feedback_id: 'not-visible' },
    { cluster_id: 'c2', feedback_id: 'f4' },
  ])

  it('de-duplicates links per cluster', () => {
    expect(membership.get('c1')).toEqual(new Set(['f1', 'f2', 'not-visible']))
  })

  it('returns only linked feedback, not feedback with a matching area', () => {
    const evidence = linkedClusterFeedback('c1', membership, FEEDBACKS)
    expect(evidence.map((feedback) => feedback.id)).toEqual(['f1', 'f2'])
  })

  it('returns no evidence for a cluster without links', () => {
    expect(linkedClusterFeedback('missing', membership, FEEDBACKS)).toEqual([])
  })
})

describe('cluster share', () => {
  it('is a whole-number percentage of visible feedback', () => {
    expect(clusterSharePercent(2, 4)).toBe(50)
    expect(clusterSharePercent(13, 142)).toBe(9)
  })

  it('never exceeds 100% when the numerator comes from visible linked feedback', () => {
    const membership = buildClusterMembership([
      { cluster_id: 'c1', feedback_id: 'f1' },
      { cluster_id: 'c1', feedback_id: 'hidden-1' },
      { cluster_id: 'c1', feedback_id: 'hidden-2' },
    ])
    const linked = linkedClusterFeedback('c1', membership, FEEDBACKS.slice(0, 1))
    expect(clusterSharePercent(linked.length, 1)).toBe(100)
  })

  it('is unavailable without a denominator', () => {
    expect(clusterSharePercent(0, 0)).toBeNull()
  })
})
