# EduInsight AI

**Student voice. Clear insight. Visible action.**

EduInsight AI (branded **EduInSight** in the application) is a multilingual student-feedback and institutional action-tracking MVP. It connects a student's concern to structured evidence, human review, an assigned response and visible follow-up.

**Alibaba Cloud AI Hackathon Pakistan 2026 · Project P00156**  
**Team:** Sajda Maryam and Fatima Sahar  
**Institution:** MNS University of Agriculture Multan

[Live application](https://eduinsight-deployment.vercel.app/) · [Source repository](https://github.com/maryamBuilds/EduInSight)

> The application requires an account. Teacher and administrator access must be provisioned by an authorised operator; privileged credentials are not published here. Demonstration records are not evidence of real student adoption or measured educational impact.

## Why we built it

University feedback collected through English-language forms or separate LMS platforms can be difficult to connect to clear, accountable follow-up. Students need room to explain their experience; teachers need usable evidence; administrators need a way to assign and track a response.

EduInsight preserves original wording and helps organise feedback into a reviewable workflow. Its central value is connecting student voice to accountable follow-up, rather than stopping at collection or sentiment analysis.

## What the MVP does

| User | Current workflow |
| --- | --- |
| Student | Submit English, Urdu, Roman Urdu or mixed-language feedback with programme and relevant course/section or service context; view personal submissions and published updates. |
| Teacher | Review identity-restricted, non-sensitive feedback and learning bottlenecks for assigned course sections. |
| Administrator | Review institutional evidence, assign an action owner, deadline and status, record internal notes and publish student-facing updates. |

The implementation includes authentication, role-scoped data access, original-text preservation, AI analysis, automatic category-based clustering, teacher/administrator dashboards, action tracking and student-facing updates.

### One feedback-to-action journey

1. A student submits a concern, such as needing slower linked-list explanations and practical examples.
2. The application stores the original feedback before requesting analysis.
3. A server-side function requests structured AI analysis and validates the response.
4. A separate database step groups eligible feedback by institution, course scope and validated category.
5. A teacher or administrator reviews the supporting evidence.
6. An administrator records an action and publishes an appropriate update for students.

Use synthetic, clearly labelled records when demonstrating this journey. An entered or completed action is not, by itself, proof that student understanding improved.

## AI's role and its limits

The analysis service produces a detected language, English summary, category, sentiment, suggested priority, responsible area, key topics, confidence and a human-review flag.

- **AI assists interpretation; people make decisions.** Analysis can be incorrect and must be checked against the original wording.
- **Clustering is a separate database operation.** The implementation groups by a validated category within institution/course scope; it is not embedding-based semantic search or a trained clustering model.
- **No custom foundation model is trained here.** The backend calls a configurable, OpenAI-compatible chat-completions API.
- **Analysis failure does not erase the submission.** Missing configuration leaves analysis pending; failures are recorded for review/retry.
- **Feedback already flagged as sensitive is excluded from external AI analysis.** This does not guarantee that every sensitive statement is automatically detected.

### Provider disclosure

The team-confirmed live deployment uses **Qwen 3.6 27B served through the Groq API**, with model identifier **`qwen/qwen3.6-27b`**.

- **Provider/API platform:** Groq.
- **Integration:** Groq's OpenAI-compatible chat-completions API, called server-side through the Supabase `analyze-feedback` Edge Function.
- **Secret storage:** The team confirms the API key is stored only in Supabase Edge Function Secrets, not in the frontend or repository. No secret values are included in this documentation.

This deployment uses Groq, not Alibaba Cloud Model Studio. The provider adapter remains configurable for other compatible deployments; Qwen-related defaults or comments in source code should not be mistaken for the live hosting platform.

## Technology and architecture

| Layer | Technology |
| --- | --- |
| Interface | React 18, TypeScript, Vite, Tailwind CSS, React Router, Lucide React icons |
| Authentication and data | Supabase Auth, PostgreSQL, Row Level Security, database views and RPC functions |
| AI orchestration | Supabase Edge Function using Deno; Qwen 3.6 27B served through the Groq API (`qwen/qwen3.6-27b`) |
| Frontend hosting | Vercel |
| Quality checks | Vitest, ESLint, TypeScript and Vite production build |

```text
React application --> Supabase Auth / PostgreSQL
       |
       +--> analyze-feedback Edge Function --> Configured AI provider
                      |
                      +--> Validated analysis --> Database clustering
```

The Edge Function checks the caller and feedback ownership/institution server-side. It sends feedback text, feedback area and university service context to the provider without adding profile IDs, emails or authentication credentials to the model request. Free text can itself contain identifying information; excluding separate identity fields does not make it anonymous.

## Run a development instance

These instructions are for **your own development Supabase project**. Do not reset, reseed or replay migrations against the existing live project to follow this guide.

### 1. Install the frontend

Prerequisites: Git, Node.js/npm compatible with the locked dependencies, and access to a Supabase project. Node.js 22.13+ is a suitable baseline for this dependency set. Supabase CLI is needed only for the CLI deployment route.

```sh
git clone https://github.com/maryamBuilds/EduInSight.git
cd EduInSight
npm ci
```

Copy `.env.example` to `.env` using your file manager or editor, then fill in:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_SUPABASE_ANON_KEY
```

These are browser-visible settings. Use the intended public/anon client key, **never a service-role key**. Access protection depends on authentication and database policies, not on hiding the public key.

### 2. Prepare the database and accounts

1. In a new Supabase project, apply the SQL files in [`supabase/migrations/`](supabase/migrations/) in numeric order, **001 through 013**, using the SQL Editor or a properly configured migration workflow. Check each result before continuing.
2. Migration `004` supplies a synthetic catalogue, not ready-made users or a complete feedback dataset. Later migrations add institution identity, analysis and automatic clustering.
3. Review the active institution, departments, courses and sections for your instance. The initial institution is `Demo University`; seeded values are demonstration configuration, not a production university registry.
4. Enable email/password authentication and email confirmation. Register through the application so required profile metadata is supplied, then confirm the email.
5. An authorised database/project operator must provision teacher/admin roles and appropriate `teacher_assignments` / `course_enrolments`. Public registration creates students only. There is no public role-selection shortcut or bundled privileged login.

The repository contains ordered SQL migrations but no complete local Supabase CLI configuration. Do not assume `supabase start` or `supabase db reset` alone reproduces the hosted environment.

### 3. Configure authentication redirects

Allow the development frontend's confirmation and password-reset destinations:

- `http://localhost:5173/login?confirmed=1`
- `http://localhost:5173/reset-password`

For your deployment, configure its Site URL and corresponding HTTPS redirect destinations. If Vite uses a different port, update the allowed development URLs. See [Supabase redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).

### 4. Configure and deploy AI analysis

Deploy the complete [`supabase/functions/analyze-feedback/`](supabase/functions/analyze-feedback/) directory, including `index.ts`, `analysis-core.ts` and `ai-provider.ts`. Configure these **Edge Function secrets/settings** in the Supabase Dashboard, not frontend `VITE_*` variables:

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | Set to `groq` for the confirmed live configuration and Groq-specific request handling. The source defaults this label to `qwen` when omitted, so configure it explicitly. |
| `AI_API_KEY` | Private provider API credential. |
| `AI_BASE_URL` | Compatible API base URL; the function appends `/chat/completions`. |
| `AI_MODEL` | The confirmed live model is `qwen/qwen3.6-27b`. No model is selected by default; verify availability for your own provider account. |
| `ALLOWED_ORIGINS` | Comma-separated exact frontend origins, including local development origins if needed. |

The function also uses hosted Supabase runtime values `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Keep privileged values server-side. The provider must support the request's structured JSON response format and configured options.

Without `ALLOWED_ORIGINS`, the code allows only `http://localhost:5173` and `http://127.0.0.1:5173`. Setting this variable replaces those defaults. Include the exact origins for your instance, not a wildcard.

Using an installed, authenticated Supabase CLI, deploy specifically to **your development project**:

```sh
supabase functions deploy analyze-feedback --project-ref YOUR_DEV_PROJECT_REF
```

The function requires a signed-in user's session and performs its own authorisation checks. Do not remove those checks to work around setup errors. See the official [deployment guide](https://supabase.com/docs/guides/functions/deploy), [Dashboard workflow](https://supabase.com/docs/guides/functions/quickstart-dashboard) and [secret management guide](https://supabase.com/docs/guides/functions/secrets).

### 5. Start and verify

```sh
npm run dev
```

Use the URL printed by Vite. Without valid Supabase frontend settings, the app intentionally reports a configuration error. Without AI server configuration, feedback can remain saved with analysis pending.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development frontend. |
| `npm test` | Run the Vitest suite. |
| `npm run lint` | Run ESLint. |
| `npm run build` | Type-check and create production `dist/` output. |
| `npm run preview` | Preview a previously built frontend locally. |

Tests in [`src/tests/`](src/tests/) cover analysis-core and provider logic. [`supabase/tests/database_security.sql`](supabase/tests/database_security.sql) contains separate database assertions; review and run them only against a suitable test database. They are not part of `npm test` and do not constitute a complete security audit.

For frontend deployment, use `npm run build`, output directory `dist`, and the two public frontend variables. The repository includes `vercel.json` for client-side routing. Deploying the frontend does not deploy the database or Edge Function.

## Demo and manual verification

Use separate browser profiles for student, teacher and administrator sessions; ordinary tabs in one profile may share the same login.

- Submit labelled synthetic feedback and confirm the original text remains unchanged.
- Check its structured analysis and human-review notice.
- Submit a related sample in the same course and check the category-based cluster.
- Verify the teacher sees only assigned sections and another student cannot read the submission.
- Record and save an action, publish an update and confirm what the student actually sees.
- Check both feedback and action status. They are distinct records; changing one does not prove every related display is synchronised.
- Exercise missing/failed analysis and sensitive-feedback handling in the test environment.

Do not use real allegations, personal records or student identifiers in a public demonstration. Obtain appropriate consent and institutional approval before a real pilot.

## Privacy, security and responsible use

- **Identity-restricted is not universally anonymous.** Teacher-facing views omit direct student identity fields and exclude sensitive feedback, while the backend retains an ownership link. Authorised administrators/operators may have broader access, and original wording may identify its author.
- Students cannot self-assign privileged roles. Database policies, views and RPC checks implement access boundaries; test their effectiveness in the deployed configuration.
- AI output is a suggestion, not a finding of fact, disciplinary decision or teacher-performance ranking.
- Do not publish API secrets, passwords, database exports, real student data or private authentication links. Inspect tracked files and Git history before sharing. Revoke/rotate genuinely exposed credentials; deletion alone does not remove historical exposure.
- Keep private environment files untracked. The current `.gitignore` covers `.env`, `.env.local` and `.env.*.local`, but **not every possible `.env.*` filename**. Verify new secret-file paths before staging. `.env.example` should contain placeholders only.

## Current limitations and future work

This is a hackathon MVP, not a completed institutional deployment. No measured learning improvement, university-wide adoption or AI accuracy percentage is claimed.

Limitations include category-based rather than fine-grained semantic clustering, dependence on an external AI service, manual privileged-account provisioning, and the need for further end-to-end, privacy and access-control testing. Early planning documents describe a broader scope; executable code and migrations establish what is implemented.

Future work includes a supervised university pilot, evaluation against human reviewers, response-time and follow-up measurements, LMS/SSO integration, additional language evaluation and personalised learning resources. Quizzes, a personal AI tutor, predictive analytics and fully automated institutional decisions are not current MVP features.

## Repository guide

| Path | Contents |
| --- | --- |
| [`src/pages/`](src/pages/) | Student, teacher, administrator and authentication screens. |
| [`src/components/`](src/components/) | Shared components and layouts. |
| [`src/context/`](src/context/) | Authentication state and account flows. |
| [`src/lib/`](src/lib/) | Supabase client, types, RPC helpers and analysis integration. |
| [`src/tests/`](src/tests/) | Analysis and provider unit tests. |
| [`supabase/functions/`](supabase/functions/) | Server-side analysis and provider adapter. |
| [`supabase/migrations/`](supabase/migrations/) | Ordered schema, access-control and workflow changes. |
| [`docs/`](docs/) | Original scope, user flows, screen plan and architecture planning. |
| [`wireframes/`](wireframes/) | Project interface wireframes. |

## Acknowledgements and authorship

Built by **Sajda Maryam and Fatima Sahar** for the **Alibaba Cloud AI Hackathon Pakistan 2026**, associated with **Alkhidmat Foundation Pakistan / Bano Qabil**.

- **AI-assisted development:** Qoder and ChatGPT/Codex assisted with development, debugging, review, documentation and presentation preparation. Product scope, integration choices, review and submission responsibility remain with the team.
- **Open-source components:** React, React DOM, React Router, TypeScript, Vite, Tailwind CSS, Lucide React, Supabase JavaScript client, Vitest, ESLint and supporting build/type packages. Direct dependencies appear in [`package.json`](package.json), with resolved dependencies in [`package-lock.json`](package-lock.json). Their respective licences and notices continue to apply.
- **Services and model:** Supabase provides authentication, database and Edge Function infrastructure; Vercel hosts the frontend. The live deployment uses **Qwen 3.6 27B served through the Groq API** (`qwen/qwen3.6-27b`). We acknowledge Qwen as the model family and Groq as the inference API platform; the team did not train this model. The API key is managed through Supabase Edge Function Secrets.
- **References:** Setup instructions link to official Supabase documentation. Original planning material is retained in `docs/` and `wireframes/`. Any additional borrowed code, assets or datasets introduced later must be credited with sources and applicable licences.

The repository does not currently include a project-wide licence file. Public visibility alone is not an open-source licence grant; contact the team through the repository before reuse beyond applicable permissions. Third-party components retain their own licences.
