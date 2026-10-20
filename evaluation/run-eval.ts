// Multilingual evaluation CLI.
//
//   node evaluation/run-eval.ts --system baseline
//   node --env-file=evaluation/.env evaluation/run-eval.ts --system model
//
// The model run reuses the production prompt, request builder and response
// validator from the analyze-feedback Edge Function, so it measures the same
// pipeline the live application uses.  Provider settings come only from
// environment variables on the machine running the evaluation (AI_API_KEY,
// AI_BASE_URL, AI_MODEL, AI_PROVIDER); they are never written to the output.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

import {
  callProvider,
  readProviderConfig,
} from '../supabase/functions/analyze-feedback/ai-provider.ts'
import { validateProviderAnalysis } from '../supabase/functions/analyze-feedback/analysis-core.ts'
import { baselinePrediction } from './baseline.ts'
import { expandDataset, summarise, type EvalCase, type EvalDataset, type Prediction } from './metrics.ts'
import { renderReport } from './report.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

const { values: args } = parseArgs({
  options: {
    system: { type: 'string', default: 'baseline' },
    dataset: { type: 'string', default: path.join(here, 'dataset', 'multilingual-eval-v1.json') },
    out: { type: 'string' },
    language: { type: 'string' },
    limit: { type: 'string' },
    'delay-ms': { type: 'string', default: '1500' },
    'blind-area': { type: 'boolean', default: false },
    label: { type: 'string' },
  },
})

const system = args.system
if (system !== 'baseline' && system !== 'model') {
  console.error('--system must be "baseline" or "model"')
  process.exit(1)
}

const dataset = JSON.parse(readFileSync(args.dataset, 'utf8')) as EvalDataset
let cases = expandDataset(dataset)
if (args.language) cases = cases.filter((evalCase) => evalCase.language === args.language)
if (args.limit) cases = cases.slice(0, Number(args.limit))

const startedAt = new Date().toISOString()
const runLabel =
  args.label ?? `${system}${args['blind-area'] ? '-blind-area' : ''}-${startedAt.slice(0, 10)}`
const outDir = args.out ?? path.join(here, 'results', runLabel)
mkdirSync(outDir, { recursive: true })

let systemDescription: string
let predictions: Prediction[]

if (system === 'baseline') {
  systemDescription = 'Rules baseline (student-selected area, service mapping, script/function-word language rules)'
  predictions = cases.map(baselinePrediction)
} else {
  const config = readProviderConfig(process.env)
  if (!config) {
    console.error('Set AI_API_KEY, AI_BASE_URL and AI_MODEL (and optionally AI_PROVIDER) to run the model evaluation.')
    process.exit(1)
  }
  systemDescription =
    `analyze-feedback prompt via provider "${config.provider}", model "${config.model}"` +
    (args['blind-area'] ? ' (student-selected area withheld)' : '')
  predictions = []
  for (const [index, evalCase] of cases.entries()) {
    const prediction = await runModelCase(config, evalCase, args['blind-area'] ?? false)
    predictions.push(prediction)
    console.log(
      `[${index + 1}/${cases.length}] ${evalCase.id} ${prediction.ok ? 'ok' : `failed (${prediction.error})`}`,
    )
    if (index < cases.length - 1) await sleep(Number(args['delay-ms']))
  }
}

const summary = summarise(cases, predictions)
writeFileSync(
  path.join(outDir, 'predictions.jsonl'),
  predictions.map((prediction) => JSON.stringify(prediction)).join('\n') + '\n',
)
writeFileSync(
  path.join(outDir, 'metrics.json'),
  JSON.stringify({ runLabel, system: systemDescription, startedAt, dataset: dataset.version, summary }, null, 2) + '\n',
)
writeFileSync(
  path.join(outDir, 'report.md'),
  renderReport(
    {
      runLabel,
      system: systemDescription,
      datasetName: dataset.name,
      datasetVersion: dataset.version,
      labelStatus: dataset.label_status,
      startedAt,
      caseCount: cases.length,
    },
    summary,
  ),
)
console.log(`Wrote ${path.relative(process.cwd(), outDir)}/report.md`)

async function runModelCase(
  config: NonNullable<ReturnType<typeof readProviderConfig>>,
  evalCase: EvalCase,
  blindArea: boolean,
): Promise<Prediction> {
  let totalTokens: number | undefined
  // Wrap fetch only to read token usage; the request itself is unchanged.
  const measuringFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init)
    try {
      const usage = ((await response.clone().json()) as { usage?: { total_tokens?: number } }).usage
      if (typeof usage?.total_tokens === 'number') totalTokens = usage.total_tokens
    } catch {
      // Usage is optional; callProvider reports invalid bodies itself.
    }
    return response
  }

  const started = performance.now()
  const outcome = await callProvider(
    config,
    {
      feedbackText: evalCase.text,
      feedbackArea: blindArea ? 'Not specified' : evalCase.studentSelectedArea,
      universityService: evalCase.universityService,
    },
    measuringFetch,
  )
  const latencyMs = Math.round(performance.now() - started)

  if (!outcome.ok) return { caseId: evalCase.id, ok: false, error: outcome.error, latencyMs, totalTokens }
  const validated = validateProviderAnalysis(outcome.content)
  if (!validated.ok) return { caseId: evalCase.id, ok: false, error: validated.error, latencyMs, totalTokens }
  const value = validated.value
  return {
    caseId: evalCase.id,
    ok: true,
    detectedLanguage: value.detectedLanguage,
    category: value.category,
    sentiment: value.sentiment,
    priority: value.priority,
    responsibleArea: value.responsibleArea,
    requiresHumanReview: value.requiresHumanReview,
    confidence: value.confidence,
    englishSummary: value.englishSummary,
    latencyMs,
    totalTokens,
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
