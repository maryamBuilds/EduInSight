// Shared, dependency-free analysis logic for the analyze-feedback Edge
// Function.  Pure TypeScript with no Deno APIs, so it runs identically in
// Deno and in Node-based unit tests.

export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type DetectedLanguage = 'en' | 'ur' | 'roman_ur' | 'mixed'
export type AnalysisSentiment = 'negative' | 'neutral' | 'positive'
export type AnalysisPriority = 'high' | 'medium' | 'low'

/** Safe machine-readable failure reasons; never raw provider output. */
export type AnalysisErrorCode =
  | 'ai_not_configured'
  | 'ai_timeout'
  | 'ai_provider_error'
  | 'ai_invalid_response'
  | 'analysis_storage_error'
  | 'sensitive_requires_human_review'

// Catalogue values mirror src/lib/constants.ts (FEEDBACK_AREAS and
// ADMIN_DEPARTMENTS).  The edge runtime cannot import frontend constants, so
// the lists are duplicated here.  Validation rejects anything outside these
// lists rather than storing unknown or conflicting values.
export const ALLOWED_LANGUAGES = ['en', 'ur', 'roman_ur', 'mixed'] as const
export const ALLOWED_SENTIMENTS = ['negative', 'neutral', 'positive'] as const
export const ALLOWED_PRIORITIES = ['high', 'medium', 'low'] as const
export const ALLOWED_CATEGORIES = [
  'Difficulty understanding a concept',
  'Difficulty applying knowledge',
  'Teaching pace or explanation',
  'Course content or organisation',
  'Learning materials and resources',
  'Assignment instructions',
  'Assessment design or fairness',
  'Grading clarity',
  'Timetable or scheduling',
  'Staff communication or availability',
  'Technical access or system failure',
  'Service availability or delay',
  'Facilities or equipment condition',
  'Accessibility or inclusion',
  'Student wellbeing or support',
  'Positive experience',
  'Suggestion for improvement',
  'Sensitive or serious concern',
] as const
export const ALLOWED_RESPONSIBLE_AREAS = [
  'IT Department',
  'Examination Office',
  'Academic Department',
  'Student Affairs',
  'Library Management',
  'Facilities Department',
  'Transport Office',
  'Finance Department',
  'University Administration',
] as const

export const MAX_SUMMARY_LENGTH = 800
export const MAX_KEY_TOPICS = 8
export const MAX_TOPIC_LENGTH = 80

// ---------------------------------------------------------------------------
// Authorisation (all inputs are read server-side; nothing trusts the browser)
// ---------------------------------------------------------------------------

export interface AnalysisCaller {
  userId: string
  role: string
  institutionId: string
}

export interface AnalysisFeedbackRef {
  studentId: string
  institutionId: string
  isSensitive: boolean
}

export type AuthorisationDecision = 'denied' | 'sensitive' | 'allowed'

/**
 * Decide whether the caller may request an analysis of this feedback.
 * Owner students and same-institution administrators are authorised; teachers
 * are not (they consume results through their restricted view).  Sensitivity
 * is only revealed to callers who are already authorised, so an
 * unauthorised caller cannot learn that a submission is sensitive.
 */
export function authoriseAnalysis(
  caller: AnalysisCaller,
  feedback: AnalysisFeedbackRef,
): AuthorisationDecision {
  let authorised = false
  if (caller.role === 'student') {
    authorised = feedback.studentId === caller.userId
  } else if (caller.role === 'admin') {
    authorised = feedback.institutionId === caller.institutionId
  }
  if (!authorised) return 'denied'
  if (feedback.isSensitive) return 'sensitive'
  return 'allowed'
}

// ---------------------------------------------------------------------------
// Duplicate, concurrent, stale and attempt-limit protection
// ---------------------------------------------------------------------------

/**
 * A processing row older than this is considered stale — left behind by an
 * interrupted or crashed function — and may be reclaimed by an authorised
 * later request.  Generous relative to the 30 s provider timeout so a
 * genuinely active analysis is never duplicated.
 */
export const PROCESSING_STALE_AFTER_MS = 5 * 60_000

/** Conservative provider-call limit before human review is required. */
export const MAX_ANALYSIS_ATTEMPTS = 3

export interface ExistingAnalysisSnapshot {
  status: AnalysisStatus
  attempts?: number
  /** ISO timestamp of the analysis row's last update, if known. */
  updatedAt?: string
}

export type ProgressionDecision =
  | { action: 'return-existing' }
  | { action: 'proceed' }
  | { action: 'attempt-limit' }

/**
 * A completed analysis is never requested again, and a genuinely active
 * (recent) processing analysis returns safely without another provider
 * call.  A stale processing row from an interrupted function may be
 * reclaimed.  Once the attempt limit is reached, no further provider call
 * is made and the outcome requires human review instead.
 */
export function decideProgression(
  existing: ExistingAnalysisSnapshot | null,
  now: Date = new Date(),
): ProgressionDecision {
  if (!existing) return { action: 'proceed' }
  if (existing.status === 'completed') return { action: 'return-existing' }
  if (existing.status === 'processing') {
    const updatedAtMs =
      existing.updatedAt === undefined ? Number.NaN : Date.parse(existing.updatedAt)
    if (Number.isNaN(updatedAtMs)) return { action: 'return-existing' }
    if (now.getTime() - updatedAtMs < PROCESSING_STALE_AFTER_MS) {
      return { action: 'return-existing' }
    }
    // Stale processing row: fall through to the attempt limit before
    // allowing a reclaim.
  }
  if ((existing.attempts ?? 0) >= MAX_ANALYSIS_ATTEMPTS) {
    return { action: 'attempt-limit' }
  }
  return { action: 'proceed' }
}

// ---------------------------------------------------------------------------
// Sensitive feedback outcome
// ---------------------------------------------------------------------------

export interface SensitiveAnalysisOutcome {
  status: 'failed'
  error_code: 'sensitive_requires_human_review'
  requires_human_review: true
  key_topics: string[]
}

/**
 * Safe outcome for sensitive feedback: never sent to the AI provider, never
 * analysed, always flagged for human review.  Contains no feedback text.
 */
export function sensitiveAnalysisRow(): SensitiveAnalysisOutcome {
  return {
    status: 'failed',
    error_code: 'sensitive_requires_human_review',
    requires_human_review: true,
    key_topics: [],
  }
}

// ---------------------------------------------------------------------------
// Provider response validation and normalisation
// ---------------------------------------------------------------------------

export interface NormalisedAnalysis {
  detectedLanguage: DetectedLanguage
  englishSummary: string
  category: string | null
  sentiment: AnalysisSentiment
  priority: AnalysisPriority
  responsibleArea: string | null
  keyTopics: string[]
  requiresHumanReview: boolean
  confidence: number | null
}

export type ValidationResult =
  | { ok: true; value: NormalisedAnalysis }
  | { ok: false; error: 'ai_invalid_response' }

/**
 * Validate and normalise a provider JSON object.  Unknown category or
 * responsible-area values are dropped (never stored as conflicting
 * duplicates); everything else outside the allowed enums is rejected so an
 * invalid response can never be marked completed.
 */
export function validateProviderAnalysis(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'ai_invalid_response' }
  }
  const record = raw as Record<string, unknown>

  const detectedLanguage = record.detected_language
  if (!isOneOf(detectedLanguage, ALLOWED_LANGUAGES)) {
    return { ok: false, error: 'ai_invalid_response' }
  }

  const englishSummary = record.english_summary
  if (typeof englishSummary !== 'string' || englishSummary.trim() === '') {
    return { ok: false, error: 'ai_invalid_response' }
  }

  const sentiment = record.sentiment
  if (!isOneOf(sentiment, ALLOWED_SENTIMENTS)) {
    return { ok: false, error: 'ai_invalid_response' }
  }

  const priority = record.priority
  if (!isOneOf(priority, ALLOWED_PRIORITIES)) {
    return { ok: false, error: 'ai_invalid_response' }
  }

  const rawCategory = record.category
  const category = isOneOf(rawCategory, ALLOWED_CATEGORIES) ? rawCategory : null

  const rawResponsibleArea = record.responsible_area
  const responsibleArea = isOneOf(rawResponsibleArea, ALLOWED_RESPONSIBLE_AREAS)
    ? rawResponsibleArea
    : null

  let requiresHumanReview =
    typeof record.requires_human_review === 'boolean' ? record.requires_human_review : true
  if (category === null) requiresHumanReview = true

  return {
    ok: true,
    value: {
      detectedLanguage,
      englishSummary: englishSummary.trim().slice(0, MAX_SUMMARY_LENGTH),
      category,
      sentiment,
      priority,
      responsibleArea,
      keyTopics: normaliseKeyTopics(record.key_topics),
      requiresHumanReview,
      confidence: normaliseConfidence(record.confidence),
    },
  }
}

// ---------------------------------------------------------------------------
// Feedback status update (success path only)
// ---------------------------------------------------------------------------

export interface FeedbackStatusUpdate {
  status: 'analysed'
  analysed_at: string
  language_detected: DetectedLanguage
}

/**
 * The only feedback modification the pipeline may ever make: record a
 * successful analysis, and only while the feedback is still 'submitted'.
 * Returns null for every other status, so AI failures and already-processed
 * feedback can never alter the stored submission.
 */
export function buildFeedbackUpdate(
  currentFeedbackStatus: string,
  detectedLanguage: DetectedLanguage,
): FeedbackStatusUpdate | null {
  if (currentFeedbackStatus !== 'submitted') return null
  return {
    status: 'analysed',
    analysed_at: new Date().toISOString(),
    language_detected: detectedLanguage,
  }
}

/**
 * Repair path for a completed analysis whose parent feedback row was never
 * updated (for example a transient update failure): reconcile only while the
 * feedback is still 'submitted', using the stored analysis language.  Never
 * triggers another provider call.
 */
export function buildReconciliationUpdate(
  existing: { status: AnalysisStatus; detected_language: string | null },
  feedbackStatus: string,
): FeedbackStatusUpdate | null {
  if (existing.status !== 'completed') return null
  if (!isOneOf(existing.detected_language, ALLOWED_LANGUAGES)) return null
  return buildFeedbackUpdate(feedbackStatus, existing.detected_language)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

function normaliseKeyTopics(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((topic): topic is string => typeof topic === 'string')
    .map((topic) => topic.trim().slice(0, MAX_TOPIC_LENGTH))
    .filter((topic) => topic !== '')
    .slice(0, MAX_KEY_TOPICS)
}

function normaliseConfidence(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  return Math.min(1, Math.max(0, raw))
}
