// EduInSight — one-time AI analysis backfill
//
// Requests the existing analyze-feedback Edge Function for every
// feedback submission that has no completed analysis yet. It signs in as an
// administrator with the public anon key, so the Edge Function applies its
// usual authorisation, sensitivity exclusion, attempt limit and clustering.
// No service-role key or AI key is used or needed here.
//
// Usage (from the repository root, with .env containing VITE_SUPABASE_URL
// and VITE_SUPABASE_ANON_KEY):
//   node scripts/backfill-analysis.mjs
// The admin email and password are asked for in the terminal and are never
// stored.

import { readFileSync } from 'node:fs'
import console from 'node:console'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { setTimeout as sleep } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'

// Groq's free tier allows a limited number of requests per minute.
const DELAY_BETWEEN_REQUESTS_MS = 2500
const PAGE_SIZE = 1000

function readEnvFile(path) {
  const values = {}
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return values
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return values
}

// One readline interface for both prompts, so piped input also works. The
// output stream is muted while the password is typed.
function createPrompt() {
  let muted = false
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding)
      callback()
    },
  })
  const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY })
  const lines = rl[Symbol.asyncIterator]()
  return {
    async ask(question, { hidden = false } = {}) {
      process.stdout.write(question)
      muted = hidden
      const { value, done } = await lines.next()
      muted = false
      if (hidden || !process.stdin.isTTY) process.stdout.write('\n')
      if (done) throw new Error('No input received.')
      return value.trim()
    },
    close: () => rl.close(),
  }
}

async function loadAll(supabase, table, columns) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Could not read ${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

async function main() {
  const env = { ...readEnvFile('.env'), ...process.env }
  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    console.error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.')
    process.exit(1)
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } })
  const prompt = createPrompt()
  const email = await prompt.ask('Admin email: ')
  const password = await prompt.ask('Admin password: ', { hidden: true })
  prompt.close()
  const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError || !session?.user) {
    console.error(`Sign-in failed: ${signInError?.message ?? 'unknown error'}`)
    process.exit(1)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') {
    console.error('This account is not an administrator.')
    process.exit(1)
  }

  // Admin RLS returns non-sensitive feedback and analyses in the admin's
  // institution only; sensitive feedback is never sent to the AI provider.
  const feedback = await loadAll(supabase, 'feedback', 'id, reference_number')
  const analyses = await loadAll(supabase, 'feedback_analysis', 'feedback_id, status')
  const completed = new Set(
    analyses.filter((row) => row.status === 'completed').map((row) => row.feedback_id),
  )
  const todo = feedback.filter((row) => !completed.has(row.id))

  console.log(
    `${feedback.length} feedback visible, ${completed.size} already analysed, ${todo.length} to analyse.`,
  )

  const outcomes = {}
  for (const [index, row] of todo.entries()) {
    const { data, error } = await supabase.functions.invoke('analyze-feedback', {
      body: { feedbackId: row.id },
    })
    const outcome = error
      ? `request_error`
      : data?.status === 'completed'
        ? 'completed'
        : `${data?.status ?? 'unknown'}${data?.errorCode ? ` (${data.errorCode})` : ''}`
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1
    console.log(`[${index + 1}/${todo.length}] ${row.reference_number}: ${outcome}`)
    if (index < todo.length - 1) await sleep(DELAY_BETWEEN_REQUESTS_MS)
  }

  console.log('\nSummary:')
  for (const [outcome, count] of Object.entries(outcomes)) console.log(`  ${outcome}: ${count}`)
  if (Object.keys(outcomes).some((outcome) => outcome !== 'completed')) {
    console.log('Run the script again to retry; each submission is tried at most 3 times in total.')
  }
  await supabase.auth.signOut()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
