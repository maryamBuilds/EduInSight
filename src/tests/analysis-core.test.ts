import { describe, expect, it } from 'vitest'
import {
  ALLOWED_LANGUAGES,
  MAX_ANALYSIS_ATTEMPTS,
  PROCESSING_STALE_AFTER_MS,
  authoriseAnalysis,
  buildFeedbackUpdate,
  buildReconciliationUpdate,
  decideProgression,
  sensitiveAnalysisRow,
  validateProviderAnalysis,
} from '../../supabase/functions/analyze-feedback/analysis-core'
import type { AnalysisFeedbackRef } from '../../supabase/functions/analyze-feedback/analysis-core'

const OWNER = { userId: 'student-1', role: 'student', institutionId: 'inst-1' }
const OTHER_STUDENT = { userId: 'student-2', role: 'student', institutionId: 'inst-1' }
const TEACHER = { userId: 'teacher-1', role: 'teacher', institutionId: 'inst-1' }
const ADMIN_SAME = { userId: 'admin-1', role: 'admin', institutionId: 'inst-1' }
const ADMIN_OTHER = { userId: 'admin-2', role: 'admin', institutionId: 'inst-2' }

const FEEDBACK: AnalysisFeedbackRef = {
  studentId: 'student-1',
  institutionId: 'inst-1',
  isSensitive: false,
}

const SENSITIVE_FEEDBACK: AnalysisFeedbackRef = {
  studentId: 'student-1',
  institutionId: 'inst-1',
  isSensitive: true,
}

const VALID_PAYLOAD = {
  detected_language: 'en',
  english_summary: '  Student reports slow Wi-Fi in the library.  ',
  category: 'Technical access or system failure',
  sentiment: 'negative',
  priority: 'medium',
  responsible_area: 'IT Department',
  key_topics: [' Wi-Fi ', 'library', ''],
  requires_human_review: false,
  confidence: 0.82,
}

describe('authoriseAnalysis', () => {
  it('allows the owner student', () => {
    expect(authoriseAnalysis(OWNER, FEEDBACK)).toBe('allowed')
  })

  it('allows a same-institution administrator', () => {
    expect(authoriseAnalysis(ADMIN_SAME, FEEDBACK)).toBe('allowed')
  })

  it('denies another student', () => {
    expect(authoriseAnalysis(OTHER_STUDENT, FEEDBACK)).toBe('denied')
  })

  it('denies teachers (they consume results, never trigger analysis)', () => {
    expect(authoriseAnalysis(TEACHER, FEEDBACK)).toBe('denied')
  })

  it('denies an administrator from another institution', () => {
    expect(authoriseAnalysis(ADMIN_OTHER, FEEDBACK)).toBe('denied')
  })

  it('returns the sensitive outcome for an authorised caller', () => {
    expect(authoriseAnalysis(OWNER, SENSITIVE_FEEDBACK)).toBe('sensitive')
    expect(authoriseAnalysis(ADMIN_SAME, SENSITIVE_FEEDBACK)).toBe('sensitive')
  })

  it('does not leak sensitivity to unauthorised callers', () => {
    expect(authoriseAnalysis(OTHER_STUDENT, SENSITIVE_FEEDBACK)).toBe('denied')
    expect(authoriseAnalysis(ADMIN_OTHER, SENSITIVE_FEEDBACK)).toBe('denied')
    expect(authoriseAnalysis(TEACHER, SENSITIVE_FEEDBACK)).toBe('denied')
  })
})

describe('decideProgression (duplicate, concurrent, stale and attempt-limit protection)', () => {
  const now = new Date('2026-08-30T12:00:00Z')

  it('proceeds when no analysis exists', () => {
    expect(decideProgression(null, now)).toEqual({ action: 'proceed' })
  })

  it('proceeds for pending and retryable failed analyses', () => {
    expect(decideProgression({ status: 'pending' }, now)).toEqual({ action: 'proceed' })
    expect(decideProgression({ status: 'failed', attempts: 2 }, now)).toEqual({
      action: 'proceed',
    })
  })

  it('never re-requests a completed analysis', () => {
    expect(decideProgression({ status: 'completed' }, now)).toEqual({ action: 'return-existing' })
  })

  it('returns safely for a recent in-flight analysis without another provider call', () => {
    const recent = new Date(now.getTime() - 60_000).toISOString()
    expect(
      decideProgression({ status: 'processing', attempts: 1, updatedAt: recent }, now),
    ).toEqual({ action: 'return-existing' })
  })

  it('reclaims a stale processing row left behind by an interrupted function', () => {
    const stale = new Date(now.getTime() - PROCESSING_STALE_AFTER_MS - 60_000).toISOString()
    expect(
      decideProgression({ status: 'processing', attempts: 1, updatedAt: stale }, now),
    ).toEqual({ action: 'proceed' })
  })

  it('treats a processing row with unknown age conservatively', () => {
    expect(decideProgression({ status: 'processing' }, now)).toEqual({
      action: 'return-existing',
    })
  })

  it('blocks further provider calls once the attempt limit is reached', () => {
    expect(
      decideProgression({ status: 'failed', attempts: MAX_ANALYSIS_ATTEMPTS }, now),
    ).toEqual({ action: 'attempt-limit' })
    expect(
      decideProgression({ status: 'pending', attempts: MAX_ANALYSIS_ATTEMPTS }, now),
    ).toEqual({ action: 'attempt-limit' })
  })

  it('does not reclaim a stale processing row once attempts are exhausted', () => {
    const stale = new Date(now.getTime() - PROCESSING_STALE_AFTER_MS - 60_000).toISOString()
    expect(
      decideProgression(
        { status: 'processing', attempts: MAX_ANALYSIS_ATTEMPTS, updatedAt: stale },
        now,
      ),
    ).toEqual({ action: 'attempt-limit' })
  })
})

describe('sensitiveAnalysisRow', () => {
  it('produces a safe human-review outcome with no AI content', () => {
    const row = sensitiveAnalysisRow()
    expect(row.status).toBe('failed')
    expect(row.error_code).toBe('sensitive_requires_human_review')
    expect(row.requires_human_review).toBe(true)
    expect(row.key_topics).toEqual([])
  })
})

describe('validateProviderAnalysis', () => {
  it('normalises a valid provider response', () => {
    const result = validateProviderAnalysis(VALID_PAYLOAD)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      detectedLanguage: 'en',
      englishSummary: 'Student reports slow Wi-Fi in the library.',
      category: 'Technical access or system failure',
      sentiment: 'negative',
      priority: 'medium',
      responsibleArea: 'IT Department',
      keyTopics: ['Wi-Fi', 'library'],
      requiresHumanReview: false,
      confidence: 0.82,
    })
  })

  it.each([...ALLOWED_LANGUAGES])('accepts %s feedback', (language) => {
    const result = validateProviderAnalysis({ ...VALID_PAYLOAD, detected_language: language })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.detectedLanguage).toBe(language)
  })

  it('drops an unknown category and forces human review', () => {
    const result = validateProviderAnalysis({
      ...VALID_PAYLOAD,
      category: 'Brand New Category',
      requires_human_review: false,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.category).toBeNull()
    expect(result.value.requiresHumanReview).toBe(true)
  })

  it('drops an unknown responsible area without failing the analysis', () => {
    const result = validateProviderAnalysis({
      ...VALID_PAYLOAD,
      responsible_area: 'Some Unknown Unit',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.responsibleArea).toBeNull()
    expect(result.value.requiresHumanReview).toBe(false)
  })

  it('clamps confidence into the 0-1 range and rejects non-numeric values', () => {
    const high = validateProviderAnalysis({ ...VALID_PAYLOAD, confidence: 1.7 })
    const low = validateProviderAnalysis({ ...VALID_PAYLOAD, confidence: -0.5 })
    const invalid = validateProviderAnalysis({ ...VALID_PAYLOAD, confidence: 'high' })
    const missing = validateProviderAnalysis({ ...VALID_PAYLOAD, confidence: undefined })
    expect(high.ok && high.value.confidence).toBe(1)
    expect(low.ok && low.value.confidence).toBe(0)
    expect(invalid.ok && invalid.value.confidence).toBeNull()
    expect(missing.ok && missing.value.confidence).toBeNull()
  })

  it('defaults requires_human_review to true when missing or non-boolean', () => {
    const missing = validateProviderAnalysis({ ...VALID_PAYLOAD, requires_human_review: undefined })
    const nonBoolean = validateProviderAnalysis({ ...VALID_PAYLOAD, requires_human_review: 'yes' })
    expect(missing.ok && missing.value.requiresHumanReview).toBe(true)
    expect(nonBoolean.ok && nonBoolean.value.requiresHumanReview).toBe(true)
  })

  it('caps and filters key topics', () => {
    const manyTopics = Array.from({ length: 12 }, (_, index) => `topic-${index}`)
    const result = validateProviderAnalysis({ ...VALID_PAYLOAD, key_topics: manyTopics })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.keyTopics).toHaveLength(8)
    expect(result.value.keyTopics).not.toContain('')
  })

  it('returns an empty topic list for non-array input', () => {
    const result = validateProviderAnalysis({ ...VALID_PAYLOAD, key_topics: 'not-an-array' })
    expect(result.ok && result.value.keyTopics).toEqual([])
  })

  it('rejects missing or empty summaries', () => {
    expect(validateProviderAnalysis({ ...VALID_PAYLOAD, english_summary: '' }).ok).toBe(false)
    expect(
      validateProviderAnalysis({ ...VALID_PAYLOAD, english_summary: undefined }).ok,
    ).toBe(false)
  })

  it('rejects values outside the allowed language, sentiment and priority enums', () => {
    expect(validateProviderAnalysis({ ...VALID_PAYLOAD, detected_language: 'french' }).ok).toBe(false)
    expect(validateProviderAnalysis({ ...VALID_PAYLOAD, sentiment: 'angry' }).ok).toBe(false)
    expect(validateProviderAnalysis({ ...VALID_PAYLOAD, priority: 'urgent' }).ok).toBe(false)
  })

  it('rejects non-object responses', () => {
    expect(validateProviderAnalysis(null).ok).toBe(false)
    expect(validateProviderAnalysis('summary text').ok).toBe(false)
    expect(validateProviderAnalysis(42).ok).toBe(false)
  })
})

describe('buildFeedbackUpdate (feedback can never be altered by AI failure)', () => {
  it('produces the analysed transition only while feedback is still submitted', () => {
    const update = buildFeedbackUpdate('submitted', 'ur')
    expect(update).toEqual({
      status: 'analysed',
      analysed_at: expect.any(String),
      language_detected: 'ur',
    })
  })

  it.each(['analysed', 'under_review', 'assigned', 'in_progress', 'resolved'])(
    'returns null for feedback already in status %s',
    (status) => {
      expect(buildFeedbackUpdate(status, 'en')).toBeNull()
    },
  )

  it('never produces a feedback update from a failed or invalid provider response', () => {
    const failures = ['ai_timeout', 'ai_provider_error', 'ai_invalid_response'] as const
    for (const errorCode of failures) {
      expect(errorCode).toBeTruthy()
      const validation = validateProviderAnalysis('not-a-valid-response')
      expect(validation.ok).toBe(false)
      const update = validation.ok
        ? buildFeedbackUpdate('submitted', validation.value.detectedLanguage)
        : null
      expect(update).toBeNull()
    }
  })
})

describe('buildReconciliationUpdate (completed-analysis recovery path)', () => {
  it('repairs a still-submitted feedback row using the stored completed analysis', () => {
    const update = buildReconciliationUpdate(
      { status: 'completed', detected_language: 'ur' },
      'submitted',
    )
    expect(update).toEqual({
      status: 'analysed',
      analysed_at: expect.any(String),
      language_detected: 'ur',
    })
  })

  it('does nothing when the feedback has already progressed past submitted', () => {
    expect(
      buildReconciliationUpdate({ status: 'completed', detected_language: 'en' }, 'analysed'),
    ).toBeNull()
    expect(
      buildReconciliationUpdate({ status: 'completed', detected_language: 'en' }, 'under_review'),
    ).toBeNull()
  })

  it('does nothing for analyses that are not completed', () => {
    expect(
      buildReconciliationUpdate({ status: 'failed', detected_language: null }, 'submitted'),
    ).toBeNull()
    expect(
      buildReconciliationUpdate({ status: 'processing', detected_language: 'en' }, 'submitted'),
    ).toBeNull()
  })

  it('does nothing when the stored detected language is missing or invalid', () => {
    expect(
      buildReconciliationUpdate({ status: 'completed', detected_language: null }, 'submitted'),
    ).toBeNull()
    expect(
      buildReconciliationUpdate({ status: 'completed', detected_language: 'french' }, 'submitted'),
    ).toBeNull()
  })
})
