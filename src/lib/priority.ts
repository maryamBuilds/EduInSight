import type { PriorityLevel, PriorityResult, PriorityFactors, TrendDirection } from './types'
import { PRIORITY_WEIGHTS } from './constants'

/**
 * Impact score lookup by feedback area.
 *
 * Maps the feedback_area value to a 0.0–1.0 score representing
 * the severity of impact on learning or institutional operations.
 */
const IMPACT_SCORES: Record<string, number> = {
  // Essential services — highest impact
  'Assessments and Examinations': 1.0,
  'Assessment design or fairness': 1.0,
  'Technical access or system failure': 0.95,

  // Core learning — high impact
  'Difficulty understanding a concept': 0.85,
  'Difficulty applying knowledge': 0.85,
  'Teaching pace or explanation': 0.80,
  'Course content or organisation': 0.80,
  'Assignment instructions': 0.75,
  'Grading clarity': 0.75,

  // Resources and facilities — moderate impact
  'Learning materials and resources': 0.65,
  'Laboratory and Practical Facilities': 0.65,
  'Library and Learning Resources': 0.60,
  'Facilities or equipment condition': 0.60,
  'IT, Wi-Fi and Learning Management System': 0.70,

  // Operational — lower impact
  'Timetable or scheduling': 0.55,
  'Staff communication or availability': 0.55,
  'Service availability or delay': 0.50,
  'Admissions and Registration': 0.50,
  'Student Records': 0.50,
  'Fees and Financial Services': 0.50,
  'Transport': 0.45,
  'Hostel and Accommodation': 0.45,
  'Cafeteria and Food Services': 0.40,
  'Campus Facilities': 0.45,

  // Support — moderate
  'Accessibility or inclusion': 0.70,
  'Accessibility and Inclusion': 0.70,
  'Student wellbeing or support': 0.70,
  'Health and Counselling': 0.65,
  'Academic Advising and Support': 0.60,
  'Career Services': 0.45,
  'Student Affairs': 0.45,
  'Clubs and Student Activities': 0.30,
  'Safety and Security': 0.75,

  // Positive / improvement — low urgency
  'Positive experience': 0.20,
  'Suggestion for improvement': 0.30,
  'Sensitive or serious concern': 0.90,
}

/**
 * Urgency score lookup by feedback area.
 *
 * Time-sensitive issues (exams, deadlines) score higher.
 */
const URGENCY_SCORES: Record<string, number> = {
  'Assessments and Examinations': 1.0,
  'Assessment design or fairness': 1.0,
  'Technical access or system failure': 0.90,
  'Timetable or scheduling': 0.80,
  'Grading clarity': 0.70,
  'Difficulty understanding a concept': 0.60,
  'Difficulty applying knowledge': 0.60,
  'Teaching pace or explanation': 0.60,
  'Assignment instructions': 0.65,
  'Course content or organisation': 0.50,
  'Learning materials and resources': 0.50,
  'Laboratory and Practical Facilities': 0.50,
  'IT, Wi-Fi and Learning Management System': 0.70,
  'Staff communication or availability': 0.50,
  'Service availability or delay': 0.50,
  'Facilities or equipment condition': 0.50,
  'Library and Learning Resources': 0.40,
  'Accessibility or inclusion': 0.60,
  'Accessibility and Inclusion': 0.60,
  'Student wellbeing or support': 0.65,
  'Health and Counselling': 0.60,
  'Safety and Security': 0.80,
  'Admissions and Registration': 0.50,
  'Student Records': 0.50,
  'Fees and Financial Services': 0.40,
  'Transport': 0.40,
  'Hostel and Accommodation': 0.40,
  'Cafeteria and Food Services': 0.30,
  'Campus Facilities': 0.40,
  'Career Services': 0.30,
  'Student Affairs': 0.30,
  'Clubs and Student Activities': 0.20,
  'Academic Advising and Support': 0.50,
  'Positive experience': 0.10,
  'Suggestion for improvement': 0.20,
  'Sensitive or serious concern': 0.85,
}

const TREND_SCORES: Record<TrendDirection, number> = {
  increasing: 1.0,
  stable: 0.5,
  improving: 0.2,
}

/** Normalise report count: 20+ reports = 1.0 */
const FREQUENCY_CAP = 20

/**
 * Calculate priority for an issue cluster using the approved formula:
 *
 *   score = frequency × 0.35 + impact × 0.30 + urgency × 0.20 + trend × 0.15
 *
 *   high   ≥ 0.70
 *   medium ≥ 0.40
 *   low    <  0.40
 */
export function calculatePriority(params: {
  reportCount: number
  feedbackArea: string | null
  universityService: string | null
  trend: TrendDirection
}): PriorityResult {
  const { reportCount, feedbackArea, universityService, trend } = params

  // Frequency (35%)
  const frequencyScore = Math.min(reportCount / FREQUENCY_CAP, 1.0)

  // Impact (30%) — look up feedbackArea first, fall back to service, default to 0.4
  const areaKey = feedbackArea ?? universityService ?? ''
  const impactScore = IMPACT_SCORES[areaKey] ?? IMPACT_SCORES[universityService ?? ''] ?? 0.4

  // Urgency (20%)
  const urgencyScore = URGENCY_SCORES[areaKey] ?? URGENCY_SCORES[universityService ?? ''] ?? 0.3

  // Trend (15%)
  const trendScore = TREND_SCORES[trend]

  // Weighted composite
  const score =
    frequencyScore * PRIORITY_WEIGHTS.frequency +
    impactScore * PRIORITY_WEIGHTS.impact +
    urgencyScore * PRIORITY_WEIGHTS.urgency +
    trendScore * PRIORITY_WEIGHTS.trend

  // Round to 2 decimal places
  const roundedScore = Math.round(score * 100) / 100

  // Determine level
  const level: PriorityLevel =
    roundedScore >= 0.70 ? 'high' :
    roundedScore >= 0.40 ? 'medium' :
    'low'

  // Build detailed factors for "Why this priority?" display
  const factors: PriorityFactors = {
    frequency: {
      count: reportCount,
      score: Math.round(frequencyScore * 100) / 100,
      weight: PRIORITY_WEIGHTS.frequency,
    },
    impact: {
      area: areaKey || 'general',
      score: Math.round(impactScore * 100) / 100,
      weight: PRIORITY_WEIGHTS.impact,
    },
    urgency: {
      type: areaKey || 'general',
      score: Math.round(urgencyScore * 100) / 100,
      weight: PRIORITY_WEIGHTS.urgency,
    },
    trend: {
      direction: trend,
      score: trendScore,
      weight: PRIORITY_WEIGHTS.trend,
    },
  }

  return { level, score: roundedScore, factors }
}
