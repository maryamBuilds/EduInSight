// Markdown rendering for evaluation summaries.  Pure TypeScript so it can be
// tested without running the CLI.

import {
  EVAL_LANGUAGES,
  LANGUAGE_NAMES,
  type ClassificationReport,
  type EvaluationSummary,
  type SubsetSummary,
} from './metrics.ts'

export interface RunInfo {
  runLabel: string
  system: string
  datasetName: string
  datasetVersion: string
  labelStatus: string
  startedAt: string
  caseCount: number
}

export function renderReport(info: RunInfo, summary: EvaluationSummary): string {
  const lines: string[] = []
  lines.push(`# Multilingual evaluation: ${info.runLabel}`)
  lines.push('')
  lines.push(`- **System evaluated:** ${info.system}`)
  lines.push(`- **Dataset:** ${info.datasetName} v${info.datasetVersion} (${info.caseCount} cases)`)
  lines.push(`- **Run started:** ${info.startedAt}`)
  lines.push('')
  lines.push(
    `> Synthetic, fictional evaluation data. Gold labels are **${info.labelStatus}**` +
      (info.labelStatus === 'provisional'
        ? ' and have not yet been independently reviewed by two bilingual reviewers.'
        : '.') +
      ' Small samples: each language has only a few cases per class, so treat differences of a few points as noise.',
  )
  lines.push('')

  lines.push('## Results by language')
  lines.push('')
  lines.push(
    '| Measure | Overall | ' + EVAL_LANGUAGES.map((language) => LANGUAGE_NAMES[language]).join(' | ') + ' |',
  )
  lines.push('| --- | --- | ' + EVAL_LANGUAGES.map(() => '---').join(' | ') + ' |')
  const subsets = [summary.overall, ...EVAL_LANGUAGES.map((language) => summary.byLanguage[language])]
  const row = (label: string, value: (subset: SubsetSummary) => string) =>
    lines.push(`| ${label} | ${subsets.map(value).join(' | ')} |`)

  row('Cases', (s) => String(s.n))
  row('Valid output rate', (s) => pct(s.validOutputRate))
  row('Language accuracy', (s) => pct(s.language.accuracy))
  row('Category accuracy (strict)', (s) => pct(s.category.accuracy))
  row('Category accuracy (accepting listed alternatives)', (s) => pct(s.categoryLenientAccuracy))
  row('Category macro-F1', (s) => f1(s.category.macroF1))
  row('Sentiment accuracy (strict)', (s) => pct(s.sentiment.accuracy))
  row('Sentiment macro-F1', (s) => f1(s.sentiment.macroF1))
  row('Priority accuracy (strict)', (s) => pct(s.priority.accuracy))
  row('Priority macro-F1', (s) => f1(s.priority.macroF1))
  row('Responsible-area accuracy (strict)', (s) => pct(s.responsibleArea.accuracy))
  row('Responsible-area accuracy (accepting alternatives)', (s) => pct(s.responsibleAreaLenientAccuracy))
  row('High-priority recall', (s) => ratio(s.highPriority.truePositives, s.highPriority.positives))
  row('Sensitive-concern recall', (s) =>
    ratio(s.sensitiveDetection.truePositives, s.sensitiveDetection.positives),
  )
  row('Sensitive false alarms', (s) => String(s.sensitiveDetection.falsePositives))
  row('Prompt injection followed', (s) => ratio(s.injectionFollowed, s.injectionCases))
  row('Latency p50 / p95', (s) =>
    s.latencyP50Ms === null ? 'n/a' : `${ms(s.latencyP50Ms)} / ${ms(s.latencyP95Ms)}`,
  )
  row('Mean tokens per call', (s) =>
    s.meanTotalTokens === null ? 'n/a' : String(Math.round(s.meanTotalTokens)),
  )
  lines.push('')

  lines.push('## Language confusion (rows = true language, columns = detected)')
  lines.push('')
  lines.push(...renderConfusion(summary.overall.language))
  lines.push('')

  lines.push('## Category errors (overall)')
  lines.push('')
  const errors = categoryErrors(summary.overall.category)
  if (errors.length === 0) {
    lines.push('No category errors.')
  } else {
    lines.push('| True category | Predicted | Count |')
    lines.push('| --- | --- | --- |')
    for (const error of errors) lines.push(`| ${error.gold} | ${error.predicted} | ${error.count} |`)
  }
  lines.push('')

  lines.push('## Per-category F1 (overall)')
  lines.push('')
  lines.push('| Category | Support | Precision | Recall | F1 |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const [label, metrics] of Object.entries(summary.overall.category.perClass)) {
    lines.push(
      `| ${label} | ${metrics.support} | ${f1(metrics.precision)} | ${f1(metrics.recall)} | ${f1(metrics.f1)} |`,
    )
  }
  lines.push('')
  return lines.join('\n')
}

function renderConfusion(report: ClassificationReport): string[] {
  const columns = [...new Set(Object.values(report.confusion).flatMap((row) => Object.keys(row)))].sort()
  const lines = [
    `| True \\ Detected | ${columns.join(' | ')} |`,
    `| --- | ${columns.map(() => '---').join(' | ')} |`,
  ]
  for (const gold of Object.keys(report.confusion).sort()) {
    lines.push(`| ${gold} | ${columns.map((column) => report.confusion[gold][column] ?? 0).join(' | ')} |`)
  }
  return lines
}

function categoryErrors(report: ClassificationReport) {
  const errors: Array<{ gold: string; predicted: string; count: number }> = []
  for (const [gold, row] of Object.entries(report.confusion)) {
    for (const [predicted, count] of Object.entries(row)) {
      if (predicted !== gold) errors.push({ gold, predicted, count })
    }
  }
  return errors.sort((a, b) => b.count - a.count || a.gold.localeCompare(b.gold))
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function f1(value: number): string {
  return value.toFixed(2)
}

function ratio(numerator: number, denominator: number): string {
  return denominator === 0 ? 'n/a' : `${numerator}/${denominator}`
}

function ms(value: number | null): string {
  return value === null ? 'n/a' : `${Math.round(value)} ms`
}
