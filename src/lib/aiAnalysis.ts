/**
 * Frontend helpers for the secure AI feedback-analysis pipeline.
 *
 * All analysis runs server-side in the analyze-feedback Edge Function; this
 * module only invokes it with a feedback ID (never feedback text) and maps
 * outcomes to safe display labels.  Every helper degrades gracefully: an
 * unavailable analysis never blocks feedback submission or dashboard use.
 */
import { supabase } from './supabase'
import type {
  AnalysisErrorCode,
  AnalysisStatus,
  DetectedLanguage,
  FeedbackAnalysis,
  TeacherAnalysisRow,
} from './types'

export interface AnalysisInvokeResult {
  status: AnalysisStatus
  errorCode: AnalysisErrorCode | null
  requiresHumanReview: boolean
}

/**
 * Mirror of MAX_ANALYSIS_ATTEMPTS in the analyze-feedback Edge Function.
 * Once reached, the server stops calling the provider and the outcome
 * requires human review.
 */
export const MAX_ANALYSIS_ATTEMPTS = 3

/**
 * Invoke the server-side analysis for an already-saved feedback submission.
 * Returns null on any transport or function error — the submission itself is
 * unaffected and analysis can be retried later.
 */
export async function requestFeedbackAnalysis(
  feedbackId: string,
): Promise<AnalysisInvokeResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-feedback', {
      body: { feedbackId },
    })
    if (error || !data) return null
    const parsed = data as {
      status?: unknown
      errorCode?: unknown
      requiresHumanReview?: unknown
    }
    if (typeof parsed.status !== 'string') return null
    return {
      status: parsed.status as AnalysisStatus,
      errorCode:
        typeof parsed.errorCode === 'string' ? (parsed.errorCode as AnalysisErrorCode) : null,
      requiresHumanReview: parsed.requiresHumanReview === true,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Safe display labels (never expose internal AI errors)
// ---------------------------------------------------------------------------

export const LANGUAGE_LABELS: Record<DetectedLanguage, string> = {
  en: 'English',
  ur: 'Urdu',
  roman_ur: 'Roman Urdu',
  mixed: 'Mixed Urdu–English',
}

/** Safe label for a failed analysis outcome. */
export function analysisErrorLabel(errorCode: AnalysisErrorCode | null | undefined): string {
  switch (errorCode) {
    case 'sensitive_requires_human_review':
      return 'Human review required'
    case 'ai_not_configured':
      return 'Analysis pending'
    case 'ai_timeout':
      return 'Analysis timed out'
    case 'ai_provider_error':
      return 'Analysis failed'
    case 'ai_invalid_response':
      return 'Analysis returned unusable output'
    default:
      return 'Analysis unavailable'
  }
}

/** Staff-facing status label for dashboards. */
export function analysisStatusLabel(analysis: {
  status: AnalysisStatus
  error_code: AnalysisErrorCode | null
}): string {
  if (analysis.status === 'completed') return 'Analysis completed'
  if (analysis.status === 'processing') return 'Analysis in progress'
  if (analysis.status === 'pending') return 'Analysis pending'
  return analysisErrorLabel(analysis.error_code)
}

/** Student-safe status text: no internal AI error detail is ever shown. */
export function studentAnalysisLabel(
  status: AnalysisStatus,
  errorCode: AnalysisErrorCode | null,
): string {
  if (status === 'completed') return 'Analysis completed'
  if (errorCode === 'sensitive_requires_human_review') return 'Human review required'
  if (status === 'processing') return 'Analysing your feedback…'
  return 'Analysis pending'
}

// ---------------------------------------------------------------------------
// Tolerant data loaders (analysis unavailability must not break dashboards)
// ---------------------------------------------------------------------------

/** Teacher-visible analysis rows, scoped to assigned sections by the view. */
export async function loadTeacherAnalyses(): Promise<TeacherAnalysisRow[]> {
  try {
    const { data, error } = await supabase.from('feedback_analysis_for_teacher').select('*')
    if (error || !data) return []
    return data as TeacherAnalysisRow[]
  } catch {
    return []
  }
}

/** Institution-wide analysis rows for administrators, newest first. */
export interface AdminAnalysisRow extends FeedbackAnalysis {
  feedback: {
    reference_number: string
    feedback_area: string
    university_service: string
    submitted_at: string
  } | null
}

export async function loadAdminAnalyses(): Promise<AdminAnalysisRow[]> {
  try {
    const { data, error } = await supabase
      .from('feedback_analysis')
      .select('*, feedback(reference_number, feedback_area, university_service, submitted_at)')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error || !data) return []
    return data as AdminAnalysisRow[]
  } catch {
    return []
  }
}
