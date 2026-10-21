import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { baselinePrediction, detectLanguageByRules } from '../../evaluation/baseline'
import {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_RESPONSIBLE_AREAS,
  ALLOWED_SENTIMENTS,
} from '../../supabase/functions/analyze-feedback/analysis-core'
import {
  EVAL_LANGUAGES,
  binaryReport,
  classificationReport,
  expandDataset,
  lenientAccuracy,
  percentile,
  summarise,
  type EvalDataset,
} from '../../evaluation/metrics'
import { renderReport } from '../../evaluation/report'

const dataset = JSON.parse(
  readFileSync(
    path.resolve(__dirname, '../../evaluation/dataset/multilingual-eval-v1.json'),
    'utf8',
  ),
) as EvalDataset

describe('evaluation dataset', () => {
  const cases = expandDataset(dataset)

  it('is balanced across the four supported languages', () => {
    for (const language of EVAL_LANGUAGES) {
      expect(cases.filter((c) => c.language === language)).toHaveLength(dataset.scenarios.length)
    }
  })

  it('is labelled as synthetic and provisional', () => {
    expect(dataset.notice).toMatch(/SYNTHETIC/)
    expect(dataset.label_status).toBe('provisional')
  })

  it('only uses labels the production validator accepts', () => {
    for (const scenario of dataset.scenarios) {
      expect(ALLOWED_CATEGORIES).toContain(scenario.gold.category)
      expect(ALLOWED_SENTIMENTS).toContain(scenario.gold.sentiment)
      expect(ALLOWED_PRIORITIES).toContain(scenario.gold.priority)
      expect(ALLOWED_RESPONSIBLE_AREAS).toContain(scenario.gold.responsible_area)
      for (const alt of scenario.acceptable?.category ?? []) expect(ALLOWED_CATEGORIES).toContain(alt)
      for (const alt of scenario.acceptable?.sentiment ?? []) expect(ALLOWED_SENTIMENTS).toContain(alt)
      for (const alt of scenario.acceptable?.priority ?? []) expect(ALLOWED_PRIORITIES).toContain(alt)
      for (const alt of scenario.acceptable?.responsible_area ?? []) {
        expect(ALLOWED_RESPONSIBLE_AREAS).toContain(alt)
      }
      expect(ALLOWED_CATEGORIES).toContain(scenario.student_selected_area)
    }
  })

  it('keeps case identifiers out of the feedback text', () => {
    for (const c of cases) expect(c.text).not.toMatch(/S\d{2}|REVIEW-|synthetic/i)
  })

  it('has unique scenario ids', () => {
    const ids = dataset.scenarios.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('classificationReport', () => {
  it('computes accuracy, per-class F1 and macro-F1', () => {
    const report = classificationReport([
      { gold: 'a', predicted: 'a' },
      { gold: 'a', predicted: 'b' },
      { gold: 'b', predicted: 'b' },
      { gold: 'b', predicted: 'b' },
    ])
    expect(report.accuracy).toBe(0.75)
    expect(report.perClass.a).toEqual({ precision: 1, recall: 0.5, f1: 2 / 3, support: 2 })
    expect(report.perClass.b.precision).toBeCloseTo(2 / 3)
    expect(report.perClass.b.recall).toBe(1)
    expect(report.macroF1).toBeCloseTo((2 / 3 + 0.8) / 2)
    expect(report.confusion.a).toEqual({ a: 1, b: 1 })
  })

  it('counts a missing prediction as wrong without adding a class', () => {
    const report = classificationReport([
      { gold: 'a', predicted: null },
      { gold: 'a', predicted: 'a' },
    ])
    expect(report.accuracy).toBe(0.5)
    expect(Object.keys(report.perClass)).toEqual(['a'])
    expect(report.perClass.a.recall).toBe(0.5)
  })

  it('returns zeros for an empty set', () => {
    const report = classificationReport([])
    expect(report.accuracy).toBe(0)
    expect(report.macroF1).toBe(0)
  })
})

describe('lenientAccuracy, binaryReport and percentile', () => {
  it('accepts listed alternatives only', () => {
    expect(
      lenientAccuracy([
        { gold: 'high', acceptable: ['medium'], predicted: 'medium' },
        { gold: 'high', predicted: 'low' },
        { gold: 'high', predicted: null },
      ]),
    ).toBeCloseTo(1 / 3)
  })

  it('reports recall and false negatives for safety-critical cases', () => {
    const report = binaryReport([
      { gold: true, predicted: true },
      { gold: true, predicted: false },
      { gold: false, predicted: true },
      { gold: false, predicted: false },
    ])
    expect(report).toMatchObject({
      positives: 2,
      truePositives: 1,
      falseNegatives: 1,
      falsePositives: 1,
      recall: 0.5,
      precision: 0.5,
    })
  })

  it('uses nearest-rank percentiles', () => {
    expect(percentile([], 50)).toBeNull()
    expect(percentile([400, 100, 300, 200], 50)).toBe(200)
    expect(percentile([400, 100, 300, 200], 95)).toBe(400)
  })
})

describe('rules baseline', () => {
  it('detects language from script and function words', () => {
    expect(detectLanguageByRules('The lecture was too fast and I could not follow it.')).toBe('en')
    expect(detectLanguageByRules('لیکچر بہت تیز تھا۔')).toBe('ur')
    expect(detectLanguageByRules('Lecture bohat tez tha aur samajh nahi aaya.')).toBe('roman_ur')
    expect(detectLanguageByRules('Lecture bohat fast tha, and I could not follow the pointers.')).toBe(
      'mixed',
    )
  })

  it('copies the student-selected area as its category', () => {
    const [first] = expandDataset(dataset)
    expect(baselinePrediction(first).category).toBe(first.studentSelectedArea)
  })
})

describe('summarise and renderReport', () => {
  const cases = expandDataset(dataset)

  it('scores perfect predictions as perfect', () => {
    const predictions = cases.map((c) => ({
      caseId: c.id,
      ok: true,
      detectedLanguage: c.language,
      category: c.gold.category,
      sentiment: c.gold.sentiment,
      priority: c.gold.priority,
      responsibleArea: c.gold.responsible_area,
      latencyMs: 100,
    }))
    const summary = summarise(cases, predictions)
    expect(summary.overall.category.accuracy).toBe(1)
    expect(summary.overall.sensitiveDetection.recall).toBe(1)
    expect(summary.overall.injectionFollowed).toBe(0)
    expect(summary.byLanguage.ur.language.accuracy).toBe(1)
    expect(summary.overall.latencyP95Ms).toBe(100)
  })

  it('treats failed calls as invalid output', () => {
    const summary = summarise(
      cases,
      cases.map((c) => ({ caseId: c.id, ok: false, error: 'ai_timeout' })),
    )
    expect(summary.overall.validOutputRate).toBe(0)
    expect(summary.overall.category.accuracy).toBe(0)
  })

  it('renders a report that states the data is synthetic and provisional', () => {
    const summary = summarise(cases, cases.map(baselinePrediction))
    const markdown = renderReport(
      {
        runLabel: 'test',
        system: 'baseline',
        datasetName: dataset.name,
        datasetVersion: dataset.version,
        labelStatus: dataset.label_status,
        startedAt: '2026-10-20T00:00:00.000Z',
        caseCount: cases.length,
      },
      summary,
    )
    expect(markdown).toMatch(/Synthetic, fictional evaluation data/)
    expect(markdown).toMatch(/provisional/)
    expect(markdown).toMatch(/Roman Urdu/)
  })
})
