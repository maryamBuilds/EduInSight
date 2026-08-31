// EduInSight — analyze-feedback Edge Function
//
// Secure server-side AI analysis for an already-saved feedback submission.
//
// Request:  POST { "feedbackId": "<uuid>" } with the caller's Supabase JWT.
//
// Guarantees:
//   - The caller is authenticated (auth.getUser) and authorised (owner
//     student or same-institution administrator).  All role, institution,
//     sensitivity, and ownership data is read server-side through the
//     service-role client — never trusted from the browser.
//   - Feedback is read by ID server-side; the browser never supplies
//     feedback text.
//   - Sensitive feedback is never sent to the AI provider; it receives the
//     safe sensitive_requires_human_review outcome instead.
//   - The original feedback row is only ever updated on a SUCCESSFUL
//     analysis and only while still in 'submitted' status, so no AI failure
//     can alter, roll back, or remove the student's submission.
//   - Concurrent requests are serialised through a conditional claim; a
//     completed analysis is never requested again automatically, a stale
//     processing row from an interrupted function can be reclaimed, and a
//     conservative attempt limit ends automatic retries in a safe
//     human-review-required state.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  PROCESSING_STALE_AFTER_MS,
  authoriseAnalysis,
  buildFeedbackUpdate,
  buildReconciliationUpdate,
  decideProgression,
  sensitiveAnalysisRow,
  validateProviderAnalysis,
  type AnalysisStatus,
} from './analysis-core.ts'
import { callProvider, readProviderConfig } from './ai-provider.ts'

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ServiceClient = ReturnType<typeof createClient>

interface AnalysisRowSnapshot {
  status: AnalysisStatus
  error_code: string | null
  attempts: number
  updated_at: string | null
  detected_language: string | null
}

function allowedOrigins(): string[] {
  const configured = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '')
  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS
}

/** Explicit allowlist only; arbitrary origins are never reflected. */
function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origin && allowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function envRecord(): Record<string, string | undefined> {
  return {
    AI_PROVIDER: Deno.env.get('AI_PROVIDER'),
    AI_API_KEY: Deno.env.get('AI_API_KEY'),
    AI_BASE_URL: Deno.env.get('AI_BASE_URL'),
    AI_MODEL: Deno.env.get('AI_MODEL'),
  }
}

function safeLog(feedbackId: string, stage: string, message: string): void {
  // Logs carry IDs and safe stage/error codes only — never feedback text,
  // provider responses, or secrets.
  console.warn(JSON.stringify({ feedbackId, stage, message: message.slice(0, 200) }))
}

async function markAnalysisFailed(
  admin: ServiceClient,
  feedbackId: string,
  attempts: number,
  errorCode: string,
): Promise<void> {
  const { error } = await admin
    .from('feedback_analysis')
    .update({
      status: 'failed',
      error_code: errorCode,
      requires_human_review: true,
      key_topics: [],
      attempts,
    })
    .eq('feedback_id', feedbackId)
    .eq('status', 'processing')
  if (error) safeLog(feedbackId, 'mark-failed', error.message)
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, headers)
  }
  if (origin && !allowedOrigins().includes(origin)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, headers)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Analysis service is not configured' }, 500, headers)
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required' }, 401, headers)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: userData, error: userError } = await admin.auth.getUser(
      authHeader.slice('Bearer '.length),
    )
    if (userError || !userData?.user) {
      return jsonResponse({ error: 'Authentication required' }, 401, headers)
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid request body' }, 400, headers)
    }
    const feedbackId =
      typeof body === 'object' && body !== null &&
        typeof (body as Record<string, unknown>).feedbackId === 'string'
        ? (body as Record<string, unknown>).feedbackId
        : ''
    if (!UUID_PATTERN.test(feedbackId)) {
      return jsonResponse({ error: 'A valid feedbackId is required' }, 400, headers)
    }

    // Authoritative caller profile, read server-side.
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, institution_id')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (!profile) {
      return jsonResponse({ error: 'Not authorised to analyse this feedback' }, 403, headers)
    }

    // Authoritative feedback row, read server-side by ID only.
    const { data: feedback } = await admin
      .from('feedback')
      .select(
        'id, student_id, institution_id, original_text, feedback_area, university_service, is_sensitive, status',
      )
      .eq('id', feedbackId)
      .maybeSingle()
    if (!feedback) {
      return jsonResponse({ error: 'Feedback not found' }, 404, headers)
    }

    const decision = authoriseAnalysis(
      { userId: profile.id, role: profile.role, institutionId: profile.institution_id },
      {
        studentId: feedback.student_id,
        institutionId: feedback.institution_id,
        isSensitive: feedback.is_sensitive,
      },
    )
    if (decision === 'denied') {
      return jsonResponse({ error: 'Not authorised to analyse this feedback' }, 403, headers)
    }

    const { data: existingRow } = await admin
      .from('feedback_analysis')
      .select('status, error_code, attempts, updated_at, detected_language')
      .eq('feedback_id', feedbackId)
      .maybeSingle()
    const existing = existingRow as AnalysisRowSnapshot | null

    // Sensitive feedback is never sent to an external AI provider.
    if (decision === 'sensitive') {
      if (existing?.status === 'completed') {
        return jsonResponse({ feedbackId, status: existing.status }, 200, headers)
      }
      const row = sensitiveAnalysisRow()
      const { error: upsertError } = await admin.from('feedback_analysis').upsert(
        { feedback_id: feedbackId, ...row, attempts: 0 },
        { onConflict: 'feedback_id' },
      )
      if (upsertError) safeLog(feedbackId, 'sensitive-upsert', upsertError.message)
      return jsonResponse(
        { feedbackId, status: row.status, errorCode: row.error_code },
        200,
        headers,
      )
    }

    // Duplicate/concurrent/stale/attempt-limit protection: completed and
    // genuinely active analyses are returned as-is without another provider
    // call.
    const progression = decideProgression(
      existing
        ? {
            status: existing.status,
            attempts: existing.attempts,
            updatedAt: existing.updated_at ?? undefined,
          }
        : null,
    )
    if (progression.action === 'return-existing') {
      // Repair path: a completed analysis whose parent feedback row was
      // never updated (for example a transient update failure) is
      // reconciled here without calling the provider again.
      if (existing?.status === 'completed') {
        const reconciliation = buildReconciliationUpdate(
          { status: existing.status, detected_language: existing.detected_language },
          feedback.status,
        )
        if (reconciliation) {
          const { error: reconcileError } = await admin
            .from('feedback')
            .update(reconciliation)
            .eq('id', feedbackId)
            .eq('status', 'submitted')
          if (reconcileError) {
            safeLog(feedbackId, 'reconcile-feedback', reconcileError.message)
          }
        }
      }
      return jsonResponse(
        {
          feedbackId,
          status: existing?.status,
          errorCode: existing?.error_code ?? undefined,
        },
        200,
        headers,
      )
    }

    // Attempt limit reached: no further provider calls; the outcome requires
    // human review. The row keeps its safe error code and is flagged.
    if (progression.action === 'attempt-limit') {
      const { error: limitError } = await admin
        .from('feedback_analysis')
        .update({ requires_human_review: true })
        .eq('feedback_id', feedbackId)
      if (limitError) safeLog(feedbackId, 'attempt-limit', limitError.message)
      return jsonResponse(
        {
          feedbackId,
          status: existing?.status,
          errorCode: existing?.error_code ?? undefined,
          requiresHumanReview: true,
        },
        200,
        headers,
      )
    }

    // Ensure an analysis row exists without clobbering a failed attempt.
    const { error: ensureError } = await admin.from('feedback_analysis').upsert(
      { feedback_id: feedbackId, status: 'pending', key_topics: [] },
      { onConflict: 'feedback_id', ignoreDuplicates: true },
    )
    if (ensureError) safeLog(feedbackId, 'ensure-row', ensureError.message)

    // Missing configuration: feedback stays saved, analysis waits.
    const providerConfig = readProviderConfig(envRecord())
    if (!providerConfig) {
      const { error: pendingError } = await admin.from('feedback_analysis').upsert(
        {
          feedback_id: feedbackId,
          status: 'pending',
          error_code: 'ai_not_configured',
          requires_human_review: true,
          key_topics: [],
        },
        { onConflict: 'feedback_id' },
      )
      if (pendingError) safeLog(feedbackId, 'not-configured', pendingError.message)
      return jsonResponse(
        { feedbackId, status: 'pending', errorCode: 'ai_not_configured' },
        200,
        headers,
      )
    }

    // Atomically claim the analysis. Pending and failed rows are claimable,
    // and a processing row is reclaimable only once stale (left behind by an
    // interrupted or crashed function). A concurrent request that loses the
    // claim returns safely without calling the provider.
    const staleCutoff = new Date(Date.now() - PROCESSING_STALE_AFTER_MS).toISOString()
    const { data: claimed, error: claimError } = await admin
      .from('feedback_analysis')
      .update({ status: 'processing', error_code: null })
      .eq('feedback_id', feedbackId)
      .or(`status.in.(pending,failed),and(status.eq.processing,updated_at.lt.${staleCutoff})`)
      .select('feedback_id')
    if (claimError || !claimed || claimed.length === 0) {
      return jsonResponse({ feedbackId, status: 'processing' }, 200, headers)
    }

    const attempts = (existing?.attempts ?? 0) + 1
    const outcome = await callProvider(providerConfig, {
      feedbackText: feedback.original_text,
      feedbackArea: feedback.feedback_area,
      universityService: feedback.university_service,
    }, undefined, (diagnosticCode) => safeLog(feedbackId, 'provider', diagnosticCode))

    if (!outcome.ok) {
      await markAnalysisFailed(admin, feedbackId, attempts, outcome.error)
      return jsonResponse(
        { feedbackId, status: 'failed', errorCode: outcome.error },
        200,
        headers,
      )
    }

    const validation = validateProviderAnalysis(outcome.content)
    if (!validation.ok) {
      await markAnalysisFailed(admin, feedbackId, attempts, validation.error)
      return jsonResponse(
        { feedbackId, status: 'failed', errorCode: validation.error },
        200,
        headers,
      )
    }

    const analysis = validation.value
    const { error: saveError } = await admin
      .from('feedback_analysis')
      .update({
        status: 'completed',
        detected_language: analysis.detectedLanguage,
        english_summary: analysis.englishSummary,
        category: analysis.category,
        sentiment: analysis.sentiment,
        priority: analysis.priority,
        responsible_area: analysis.responsibleArea,
        key_topics: analysis.keyTopics,
        requires_human_review: analysis.requiresHumanReview,
        confidence: analysis.confidence,
        error_code: null,
        attempts,
        completed_at: new Date().toISOString(),
      })
      .eq('feedback_id', feedbackId)
      .eq('status', 'processing')
    if (saveError) {
      safeLog(feedbackId, 'save-completed', saveError.message)
      await markAnalysisFailed(admin, feedbackId, attempts, 'analysis_storage_error')
      return jsonResponse(
        { feedbackId, status: 'failed', errorCode: 'analysis_storage_error' },
        200,
        headers,
      )
    }

    // The only feedback modification in the pipeline: a conditional update
    // while the row is still 'submitted'.  Failures here never affect the
    // stored submission.
    const feedbackUpdate = buildFeedbackUpdate(feedback.status, analysis.detectedLanguage)
    if (feedbackUpdate) {
      const { error: feedbackError } = await admin
        .from('feedback')
        .update(feedbackUpdate)
        .eq('id', feedbackId)
        .eq('status', 'submitted')
      if (feedbackError) safeLog(feedbackId, 'feedback-status', feedbackError.message)
    }

    // Clustering is a separate, idempotent database step. A clustering error
    // is logged safely but never changes or deletes the completed analysis.
    const { error: clusteringError } = await admin.rpc(
      'cluster_completed_feedback_analysis',
      { p_feedback_id: feedbackId },
    )
    if (clusteringError) safeLog(feedbackId, 'clustering', clusteringError.message)

    return jsonResponse({ feedbackId, status: 'completed' }, 200, headers)
  } catch (error) {
    safeLog(
      'unknown',
      'unexpected',
      error instanceof Error ? error.message : 'unexpected error',
    )
    return jsonResponse({ error: 'Analysis request failed' }, 500, headers)
  }
})
