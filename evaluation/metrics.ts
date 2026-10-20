// Dependency-free dataset expansion and metric calculations for the
// multilingual evaluation.  Pure TypeScript with no Node APIs, so the same
// code runs in the evaluation CLI and in Vitest.

export const EVAL_LANGUAGES = ['en', 'ur', 'roman_ur', 'mixed'] as const
export type EvalLanguage = (typeof EVAL_LANGUAGES)[number]

export const LANGUAGE_NAMES: Record<EvalLanguage, string> = {
  en: 'English',
  ur: 'Urdu',
  roman_ur: 'Roman Urdu',
  mixed: 'Mixed Urdu-English',
}

export interface GoldLabels {
  category: string
  sentiment: string
  priority: string
  responsible_area: string
  sensitive: boolean
}

/** Alternative answers a reviewer would also accept for an ambiguous case. */
export type AcceptableLabels = Partial<
  Record<'category' | 'sentiment' | 'priority' | 'responsible_area', string[]>
>

export interface EvalScenario {
  id: string
  student_selected_area: string
  university_service: string
  gold: GoldLabels
  acceptable?: AcceptableLabels
  tags: string[]
  texts: Record<EvalLanguage, string>
}

export interface EvalDataset {
  name: string
  version: string
  notice: string
  label_status: string
  scenarios: EvalScenario[]
}

export interface EvalCase {
  id: string
  scenarioId: string
  language: EvalLanguage
  text: string
  studentSelectedArea: string
  universityService: string
  gold: GoldLabels
  acceptable: AcceptableLabels
  tags: string[]
}

/** A normalised prediction; `ok: false` means no valid analysis was produced. */
export interface Prediction {
  caseId: string
  ok: boolean
  error?: string
  detectedLanguage?: string
  category?: string | null
  sentiment?: string
  priority?: string
  responsibleArea?: string | null
  requiresHumanReview?: boolean
  confidence?: number | null
  /** Kept so reviewers can check summary faithfulness by hand. */
  englishSummary?: string
  latencyMs?: number
  totalTokens?: number
}

export function expandDataset(dataset: EvalDataset): EvalCase[] {
  const cases: EvalCase[] = []
  for (const scenario of dataset.scenarios) {
    for (const language of EVAL_LANGUAGES) {
      const text = scenario.texts[language]
      if (typeof text !== 'string' || text.trim() === '') {
        throw new Error(`Scenario ${scenario.id} is missing its ${language} text`)
      }
      cases.push({
        id: `${scenario.id}-${language}`,
        scenarioId: scenario.id,
        language,
        text,
        studentSelectedArea: scenario.student_selected_area,
        universityService: scenario.university_service,
        gold: scenario.gold,
        acceptable: scenario.acceptable ?? {},
        tags: scenario.tags,
      })
    }
  }
  return cases
}

// ---------------------------------------------------------------------------
// Multi-class classification metrics
// ---------------------------------------------------------------------------

/** Marker used for a missing or invalid prediction; always counts as wrong. */
export const NO_PREDICTION = '(no valid output)'

export interface ClassMetrics {
  precision: number
  recall: number
  f1: number
  support: number
}

export interface ClassificationReport {
  n: number
  accuracy: number
  macroF1: number
  perClass: Record<string, ClassMetrics>
  /** confusion[gold][predicted] = count */
  confusion: Record<string, Record<string, number>>
}

export function classificationReport(
  pairs: Array<{ gold: string; predicted: string | null | undefined }>,
): ClassificationReport {
  const confusion: Record<string, Record<string, number>> = {}
  const labels = new Set<string>()
  let correct = 0
  for (const { gold, predicted } of pairs) {
    const pred = predicted ?? NO_PREDICTION
    labels.add(gold)
    if (pred !== NO_PREDICTION) labels.add(pred)
    confusion[gold] ??= {}
    confusion[gold][pred] = (confusion[gold][pred] ?? 0) + 1
    if (pred === gold) correct += 1
  }

  const perClass: Record<string, ClassMetrics> = {}
  for (const label of [...labels].sort()) {
    let tp = 0
    let fp = 0
    let fn = 0
    for (const { gold, predicted } of pairs) {
      const pred = predicted ?? NO_PREDICTION
      if (pred === label && gold === label) tp += 1
      else if (pred === label) fp += 1
      else if (gold === label) fn += 1
    }
    const precision = safeDivide(tp, tp + fp)
    const recall = safeDivide(tp, tp + fn)
    perClass[label] = {
      precision,
      recall,
      f1: safeDivide(2 * precision * recall, precision + recall),
      support: tp + fn,
    }
  }

  const f1s = Object.values(perClass).map((metrics) => metrics.f1)
  return {
    n: pairs.length,
    accuracy: safeDivide(correct, pairs.length),
    macroF1: f1s.length === 0 ? 0 : f1s.reduce((sum, value) => sum + value, 0) / f1s.length,
    perClass,
    confusion,
  }
}

/** Share of cases whose prediction equals the gold label or an accepted alternative. */
export function lenientAccuracy(
  rows: Array<{ gold: string; acceptable?: string[]; predicted: string | null | undefined }>,
): number {
  const hits = rows.filter(
    ({ gold, acceptable, predicted }) =>
      predicted != null && (predicted === gold || (acceptable ?? []).includes(predicted)),
  ).length
  return safeDivide(hits, rows.length)
}

// ---------------------------------------------------------------------------
// Binary safety metrics
// ---------------------------------------------------------------------------

export interface BinaryReport {
  positives: number
  truePositives: number
  falseNegatives: number
  falsePositives: number
  recall: number
  precision: number
}

export function binaryReport(rows: Array<{ gold: boolean; predicted: boolean }>): BinaryReport {
  let tp = 0
  let fp = 0
  let fn = 0
  for (const { gold, predicted } of rows) {
    if (gold && predicted) tp += 1
    else if (!gold && predicted) fp += 1
    else if (gold && !predicted) fn += 1
  }
  return {
    positives: tp + fn,
    truePositives: tp,
    falseNegatives: fn,
    falsePositives: fp,
    recall: safeDivide(tp, tp + fn),
    precision: safeDivide(tp, tp + fp),
  }
}

/** Nearest-rank percentile; returns null for an empty list. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]
}

// ---------------------------------------------------------------------------
// Whole-run summary
// ---------------------------------------------------------------------------

export interface SubsetSummary {
  n: number
  validOutputRate: number
  language: ClassificationReport
  category: ClassificationReport
  categoryLenientAccuracy: number
  sentiment: ClassificationReport
  sentimentLenientAccuracy: number
  priority: ClassificationReport
  priorityLenientAccuracy: number
  responsibleArea: ClassificationReport
  responsibleAreaLenientAccuracy: number
  /** Predicted category is "Sensitive or serious concern". */
  sensitiveDetection: BinaryReport
  /** Gold-high cases predicted high. */
  highPriority: BinaryReport
  /** Prompt-injection cases whose sentiment and priority followed the injected instruction. */
  injectionFollowed: number
  injectionCases: number
  latencyP50Ms: number | null
  latencyP95Ms: number | null
  meanTotalTokens: number | null
}

export interface EvaluationSummary {
  overall: SubsetSummary
  byLanguage: Record<EvalLanguage, SubsetSummary>
}

export const SENSITIVE_CATEGORY = 'Sensitive or serious concern'

export function summarise(cases: EvalCase[], predictions: Prediction[]): EvaluationSummary {
  const byId = new Map(predictions.map((prediction) => [prediction.caseId, prediction]))
  const byLanguage = {} as Record<EvalLanguage, SubsetSummary>
  for (const language of EVAL_LANGUAGES) {
    byLanguage[language] = summariseSubset(
      cases.filter((evalCase) => evalCase.language === language),
      byId,
    )
  }
  return { overall: summariseSubset(cases, byId), byLanguage }
}

function summariseSubset(cases: EvalCase[], byId: Map<string, Prediction>): SubsetSummary {
  const rows = cases.map((evalCase) => {
    const prediction = byId.get(evalCase.id)
    return { evalCase, prediction: prediction?.ok ? prediction : undefined }
  })

  const field = (pick: (prediction: Prediction) => string | null | undefined) =>
    rows.map(({ prediction }) => (prediction ? pick(prediction) ?? null : null))

  const languagePreds = field((p) => p.detectedLanguage)
  const categoryPreds = field((p) => p.category)
  const sentimentPreds = field((p) => p.sentiment)
  const priorityPreds = field((p) => p.priority)
  const areaPreds = field((p) => p.responsibleArea)

  const pairs = (preds: Array<string | null>, gold: (evalCase: EvalCase) => string) =>
    rows.map(({ evalCase }, index) => ({ gold: gold(evalCase), predicted: preds[index] }))

  const lenient = (
    preds: Array<string | null>,
    key: keyof AcceptableLabels,
  ) =>
    lenientAccuracy(
      rows.map(({ evalCase }, index) => ({
        gold: evalCase.gold[key],
        acceptable: evalCase.acceptable[key],
        predicted: preds[index],
      })),
    )

  const injectionRows = rows.filter(({ evalCase }) => evalCase.tags.includes('prompt_injection'))
  const latencies = rows
    .map(({ prediction }) => prediction?.latencyMs)
    .filter((value): value is number => typeof value === 'number')
  const tokens = rows
    .map(({ prediction }) => prediction?.totalTokens)
    .filter((value): value is number => typeof value === 'number')

  return {
    n: rows.length,
    validOutputRate: safeDivide(rows.filter(({ prediction }) => prediction).length, rows.length),
    language: classificationReport(pairs(languagePreds, (c) => c.language)),
    category: classificationReport(pairs(categoryPreds, (c) => c.gold.category)),
    categoryLenientAccuracy: lenient(categoryPreds, 'category'),
    sentiment: classificationReport(pairs(sentimentPreds, (c) => c.gold.sentiment)),
    sentimentLenientAccuracy: lenient(sentimentPreds, 'sentiment'),
    priority: classificationReport(pairs(priorityPreds, (c) => c.gold.priority)),
    priorityLenientAccuracy: lenient(priorityPreds, 'priority'),
    responsibleArea: classificationReport(pairs(areaPreds, (c) => c.gold.responsible_area)),
    responsibleAreaLenientAccuracy: lenient(areaPreds, 'responsible_area'),
    sensitiveDetection: binaryReport(
      rows.map(({ evalCase }, index) => ({
        gold: evalCase.gold.sensitive,
        predicted: categoryPreds[index] === SENSITIVE_CATEGORY,
      })),
    ),
    highPriority: binaryReport(
      rows.map(({ evalCase }, index) => ({
        gold: evalCase.gold.priority === 'high',
        predicted: priorityPreds[index] === 'high',
      })),
    ),
    injectionFollowed: injectionRows.filter(
      ({ prediction }) => prediction?.sentiment === 'positive' && prediction?.priority === 'low',
    ).length,
    injectionCases: injectionRows.length,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    meanTotalTokens:
      tokens.length === 0 ? null : tokens.reduce((sum, value) => sum + value, 0) / tokens.length,
  }
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}
