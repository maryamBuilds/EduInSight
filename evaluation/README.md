# Multilingual AI evaluation

This folder measures how well the `analyze-feedback` analysis handles English, Urdu, Roman Urdu and mixed Urdu-English feedback, using a labelled test set and standard metrics rather than "the output looks right".

> **Synthetic demonstration data.** Every case in `dataset/` is fictional and written only for evaluation. Gold labels are **provisional** until two bilingual reviewers have labelled the cases independently and resolved disagreements (see [Label review](#label-review)). Do not present results as final accuracy until then.

## What is measured

| Measure | Reported as | Why it matters |
| --- | --- | --- |
| Language detection | Accuracy and a confusion matrix per language | Roman Urdu vs. mixed is the hardest boundary |
| Category | Accuracy, macro-F1, per-category F1, error table | Drives clustering and routing |
| Sentiment | Accuracy and macro-F1 | Includes negation cases ("not bad", "not confusing") |
| Priority | Accuracy, macro-F1 and **high-priority recall** | Missing an urgent case matters more than over-flagging |
| Responsible area | Accuracy (strict and accepting listed alternatives) | Who should own the action |
| Sensitive concerns | **Recall**, false negatives and false alarms | Safety net when a student does not flag a serious concern |
| Prompt injection | Cases where the model obeyed text inside the feedback | Feedback is untrusted input |
| Operations | Valid-output rate, p50/p95 latency, mean tokens per call | Reliability and cost |

Every result is broken down by language, so the presentation can show whether Urdu or Roman Urdu feedback is understood as well as English.

## Dataset design

`dataset/multilingual-eval-v1.json` has **22 scenarios × 4 language forms = 88 cases**. Each scenario is written in English, Urdu script, Roman Urdu and mixed Urdu-English and shares one set of gold labels, so a difference between languages is not caused by a different topic.

The scenarios deliberately include positive feedback, a suggestion, negation, multiple concerns, misspellings and informal spelling, a prompt-injection attempt, a wellbeing case, an accessibility case, and two fictional serious concerns that the student did **not** flag as sensitive. In four scenarios the area the student selected on the form is not the best category, which tests whether the AI reads the text rather than copying the form.

Case identifiers are kept outside the feedback text so they cannot influence the model.

### Labelling guide

- **Language:** `en` = English only. `ur` = Urdu script. `roman_ur` = Urdu grammar in Latin script, including common English loanwords and technical terms ("lecture", "LMS", "assignment"). `mixed` = clause-level switching between Urdu and English, in either script.
- **Category:** the single best category from the production list; the main concern if there are several. A clear second reading goes in `acceptable`.
- **Sentiment:** the student's overall stance. Suggestions are `neutral` unless clearly positive.
- **Priority:** `high` = safety, harassment, misconduct, accessibility barriers, wellbeing, or an imminent deadline/exam impact; `medium` = an ongoing learning or service problem; `low` = positive feedback, suggestions, minor one-off issues.
- **Responsible area:** the office that would own the action. Plausible second owners go in `acceptable`.
- **Sensitive:** harassment, discrimination, misconduct, corruption or safety concerns that should go to a restricted reviewer.

## Running it

```sh
# Rules baseline: what a plain form reports without AI. No API key needed.
npm run eval:baseline
```

### Real-model run (uses a separate Groq account)

Groq rate limits apply to the whole **organisation (account)**, not to each key, so a second key on the live site's account would spend the quota the demo needs. Use a **separate free Groq account** for evaluation:

1. Sign up at [console.groq.com](https://console.groq.com) with a different email address from the live site's account.
2. Open **API Keys**, choose **Create API Key**, name it `eduinsight-eval`, and copy it.
3. In this repository, create `evaluation/.env` (it is git-ignored) containing:

   ```dotenv
   AI_PROVIDER=groq
   AI_BASE_URL=https://api.groq.com/openai/v1
   AI_MODEL=qwen/qwen3.8-27b
   AI_API_KEY=paste-the-new-key-here
   ```

   Use the same `AI_MODEL` as the live site. Do not add `AI_FALLBACK_MODELS`: the runner ignores fallbacks so all results come from one model.
4. Run `npm ci` once, then `npm run eval:model`. Node.js 22.6 or newer is needed.

A full run is 88 calls, about 1K tokens each, spaced 9 seconds apart to stay under the free plan's tokens-per-minute limit: roughly 15 minutes and about 100K of the 200K daily tokens. If it stops after three failures in a row (usually a rate limit), run the same command again later; finished cases are kept and only the rest are retried. `--fresh` starts over.

The text-only run hides the area the student picked, to test understanding of the words alone. Run it on another day, or after the first run, because two full runs come close to the daily token limit:

```sh
npm run eval:model -- --blind-area
```

Other options: `--language roman_ur`, `--limit 8` (quick check), `--delay-ms 9000`, `--label my-run`.

Each run writes `results/<label>/report.md`, `metrics.json` and `predictions.jsonl` (`results/model/` by default). The API key is read only from the environment and is never written to results. Never commit `evaluation/.env`.

## Reading the baseline

`results/baseline-v1/report.md` is the committed rules baseline. It copies the student-selected area as the category, so it scores well whenever the student picked correctly, but it finds **0 of 8** sensitive concerns, catches only **8 of 28** high-priority cases, and cannot correct a mis-selected area. The AI should be judged on how much it improves on those numbers, not only on its absolute accuracy.

## Label review

Before quoting final results:

1. Give two bilingual reviewers the cases without the gold labels and ask each to label independently.
2. Record agreement (for example Cohen's kappa) for category, priority and sensitivity.
3. Resolve disagreements, update `dataset/` and change `label_status` to `reviewed`.
4. Keep an unseen set of new cases for the final run so prompt changes are not tuned to this set.

## Limits

- 88 cases is small: each language has 22 cases and most categories have one scenario, so a single error moves a per-language score by about 4.5 points.
- The four language forms of a scenario are not independent samples.
- Synthetic text is cleaner than real student writing. Results do not show real-world accuracy, adoption or educational impact.
- Summary quality (faithful meaning, no invented facts, preserved negation) still needs a human check of `english_summary` on a sample.
- Model `confidence` is not calibrated accuracy.
