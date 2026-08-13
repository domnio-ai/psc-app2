# Felix and App2 Current Architecture and Gap Analysis

**Assessment date:** 2026-08-03  
**App2 repository:** `app2`  
**Branch:** `main`  
**Commit inspected:** `b6644c5f23cbbdacb57a2f619cb77e7a937faf4c`  
**Related service:** sibling directory `ai-research-service` (not part of the App2 Git worktree)

## Scope and method

This report records the architecture that exists before the Felix upgrade. The inspection covered the App2 frontend, App2 API, both SQL schemas, the separate AI research service, deployment and setup files, CI workflows, documentation, and tracked source files. Generated output, `node_modules`, uploaded file contents, secret values, and the Android APK were not inspected as application source.

No major architecture or runtime behavior was changed during Phase 1.

## Current technology stack

| Area | Current implementation |
| --- | --- |
| App2 frontend | React 19, TypeScript 5.9, Vite 7, hand-written CSS |
| App2 API | Node.js, Express 5, ES modules |
| Validation and security middleware | Zod, Helmet, CORS, bcryptjs, jsonwebtoken |
| App2 database | PostgreSQL accessed through `pg` connection pools and parameterized SQL |
| ORM / migration framework | None. Schemas are plain SQL and local setup is performed by scripts. |
| Felix / AI API | Python 3.11+, FastAPI, Uvicorn, Pydantic Settings |
| AI database access | Psycopg 3 and `psycopg_pool`, with raw parameterized SQL |
| Local model provider | Ollama |
| Current model | `qwen2.5:3b`, configurable through `OLLAMA_MODEL` even though it is absent from the checked-in AI `.env.example` |
| AI HTTP integration | `httpx` to Ollama and the App2 API |
| File storage | Local filesystem under the configured App2 upload directory; metadata is stored in PostgreSQL |
| Deployment | Dockerfiles for all services; App2 Compose includes PostgreSQL, API, and Nginx-served frontend, but not the AI service |
| CI/security | GitHub Actions for build, Node dependency audit, backend syntax checks, and CodeQL; Dependabot configuration is present |

## Repository structure

```text
referenced-chatgpt-conversation-this-is-untrusted/
├── app2/                         # Git repository for the web application
│   ├── src/
│   │   ├── App.tsx              # Main application shell and most page implementations
│   │   ├── api.ts               # Typed frontend API client
│   │   ├── AIResearchChat.tsx   # Full Felix chat/research UI
│   │   ├── FelixAssistant.tsx   # Floating Felix launcher
│   │   ├── CalendarView.tsx
│   │   ├── NoticeBoardWorkspace.tsx
│   │   ├── NoticeComposer.tsx
│   │   ├── NotificationCenter.tsx
│   │   └── *.css
│   ├── backend/
│   │   ├── src/app.js           # Express middleware and all App2 routes
│   │   ├── src/auth.js          # JWT authentication and role middleware
│   │   ├── src/audit.js         # Audit insert helper
│   │   ├── src/config.js        # Required environment settings
│   │   ├── src/db.js            # PostgreSQL pool and transaction helper
│   │   ├── src/mailer.js        # Optional SMTP delivery
│   │   ├── src/schema.sql        # App2 schema, indexes, and additive ALTER statements
│   │   ├── src/setup-database.js # Schema execution and development seed data
│   │   └── src/server.js
│   ├── .github/                  # CodeQL, security workflow, Dependabot
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── nginx.conf
│   └── docs/                     # Architecture documentation begins here
├── ai-research-service/
│   ├── app/main.py              # Settings, auth, App2 retrieval, Ollama calls, research-job API
│   ├── app/schema.sql            # AI research jobs, sources, and events
│   ├── run.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── setup-local.ps1
├── outputs/psc-mobile-debug.apk  # Generated mobile artifact
└── work/                         # No inspected tracked application source
```

Architecturally, `App.tsx`, `backend/src/app.js`, and `ai-research-service/app/main.py` are large, concentrated modules. They contain most UI, API, and AI behavior respectively, with limited separation into services or routers.

## Existing App2 modules

The role-filtered frontend navigation exposes these modules:

- Dashboard
- Assignments
- Knowledge Repository
- Research Repository
- AI Researcher / Felix
- Documents and document review
- Team & Users
- Reports & Analytics
- Audit Logs
- Notifications
- Notice Board
- Calendar
- Settings and Profile

Supporting backend capabilities include authentication and password recovery, document versioning and downloads, assignment attachments/comments/history, document checkout locks and retention, notification generation, SMTP testing, system preferences, and update/health information.

The UI is primarily implemented in `src/App.tsx`. Felix-specific surfaces are `AIResearchChat.tsx` and `FelixAssistant.tsx`. The API client in `src/api.ts` maps UI operations to both the App2 API (`VITE_API_URL`, default port 8000) and AI API (`VITE_AI_API_URL`, default port 8100).

## Felix request flow

```text
Authenticated browser
  -> AIResearchChat calls src/api.ts
  -> POST http://127.0.0.1:8100/api/chat with App2 bearer token
  -> FastAPI current_user()
       1. verifies JWT signature, issuer and audience
       2. calls App2 GET /api/auth/me to validate the live session
       3. confirms App2 user ID matches JWT subject
  -> handles simple conversation/report/action intents directly, or
  -> app2_context() calls permission-filtered App2 endpoints
  -> optional download and extraction of one ranked document
  -> prompt plus recent chat history sent to Ollama /api/chat
  -> answer, model label, references and optional proposed action returned
  -> UI renders answer and requires confirmation for supported actions
```

Current action proposals are limited to navigation, notice drafts, assignment drafts, and assignment-status changes. Confirmation occurs in the frontend and final mutations still go through App2 endpoints and their backend authorization rules. The AI service itself does not push, merge, deploy, or execute repository commands.

## Ollama integration

`ai-research-service/app/main.py` owns Ollama communication:

- `OLLAMA_URL` defaults to `http://127.0.0.1:11434`.
- `OLLAMA_MODEL` defaults to `qwen2.5:3b`.
- Startup schedules a warm-up request to `/api/generate` with a one-token response and 30-minute keep-alive.
- Health/state checks call `/api/tags`.
- Chat calls `/api/chat` with temperature `0.2`, `num_predict` 160, and `num_ctx` 4096.
- At most eight user/assistant history items are sent after compacting each to 2,000 characters.
- Paid providers default to disabled. GPT Researcher and ResearchMate are represented only as unavailable future adapters.

There is no provider interface, retry policy, structured research response schema, token budgeting by retrieved evidence, citation-grounded generation step, or model evaluation gate.

## Current document-processing flow

### App2 storage and workflow

1. The browser uploads a raw `application/octet-stream` body plus metadata in `X-*` headers.
2. Express limits requests using `MAX_UPLOAD_MB`, normalizes the original basename, generates a random stored filename, and writes the bytes under `UPLOAD_DIR`.
3. `knowledge_items` stores descriptive metadata and workflow state.
4. `knowledge_versions` stores each physical version's filename, MIME type, size, uploader, notes, and version number.
5. Owners/managers submit items; authorized reviewers approve or reject them; publication, reviews, downloads, and selected changes are audited.
6. Metadata search uses PostgreSQL English full-text search over title, description, and author, plus exact tag membership.

### Felix retrieval and extraction

Felix does not maintain a document index. For document-related prompts it:

1. Fetches knowledge/document records visible through the authenticated App2 API.
2. Ranks them using overlap between prompt words and title/description words.
3. Selects at most one document.
4. Requests its versions and downloads the latest returned version.
5. Extracts up to 12,000 characters only from DOCX XML or UTF-8 text/Markdown/CSV.
6. Places compacted content directly into an Ollama system prompt.

PDF, XLSX, PPTX, scanned images, OCR, page boundaries, sections, author/institution extraction, language detection, chunking, deduplication, embeddings, incremental indexing, and citation offsets are absent. Extraction failure silently yields no content.

## Database design

### App2 database

The App2 schema contains:

- Identity: `users`, `password_reset_tokens`, `user_preferences`
- Assignments: `assignments`, `assignment_members`, `assignment_comments`, `assignment_history`, `assignment_attachments`
- Knowledge/documents: `knowledge_items`, `knowledge_versions`, `knowledge_assignment_links`, `knowledge_downloads`, `document_locks`, `document_reviews`
- Research: `research_projects`, `research_collaborators`, `research_milestones`, `research_knowledge_links`
- Communication and governance: `alerts`, `notifications`, `audit_logs`, `system_settings`

Foreign keys model ownership, membership, collaboration, versioning, assignment links, review events, notifications, and audit actors. Useful indexes exist for common member, status, history, notification, knowledge metadata-search, and review queries.

There is no ORM. `setup-database.js` executes `schema.sql` and seeds local users/data. Additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements act as ad hoc upgrades; there is no ordered, versioned migration history or schema-version table.

### AI research database

The separate AI schema contains:

- `research_jobs`: question, scope, source mode, plan, status, progress, report, owner and reviewer fields
- `research_sources`: source title/type/URL, optional App2 document ID, excerpt, and citation number
- `research_events`: actor, event, details, and timestamp

FastAPI executes the entire idempotent schema at service startup. Job ownership is stored as App2 UUID values without cross-database foreign keys.

### Vector support

Neither schema enables the `vector` extension, declares vector columns, or defines vector indexes. No pgvector client dependency, embedding model, chunk table, similarity query, or alternative vector database is configured. Current App2 search is metadata full-text search, not passage retrieval.

## Authentication and permissions

App2 uses signed HS256 JWTs with issuer `psc-app2`, audience `psc-app2-web`, expiry, and a per-user `token_version`. Each authenticated request reloads the active user from PostgreSQL; logout and password/admin changes invalidate sessions by incrementing the version. Passwords are bcrypt-hashed. CORS uses one configured frontend origin and Helmet supplies standard security headers.

Roles are:

- **Administrator:** all frontend modules; user/role management, system settings, audit logs, and manager/reviewer operations.
- **Research Manager:** most management, assignment, document, research, reporting and review capabilities; no Audit Logs page.
- **Research Officer:** assigned work, knowledge/research participation, Felix, documents, notices, notifications, calendar, and personal settings. The UI currently includes Team & Users, but the API restricts its data to managers/administrators.
- **Reviewer:** assignment and document review-oriented modules, notices, notifications, calendar, and settings. The full AI Researcher page is not included in Reviewer navigation although the AI job API grants reviewers broad job visibility.

Authorization is enforced with `authenticate`, role-level `authorize(...)`, and selected resource helpers (`canAccessAssignment`, `canReadKnowledge`). The AI service additionally validates the same JWT and confirms the live App2 session before accessing App2 APIs. App2 endpoints filter assignment, knowledge, document, research, notification, and audit data in varying degrees.

## Existing APIs and services

The Express API has routes for:

- `/api/auth/*`: login, current identity, logout, password change and reset
- `/api/users/*`: listing, creation, updates, role and password administration
- `/api/assignments/*`: CRUD, status, members, comments, history and attachments
- `/api/knowledge/*`: metadata, upload, versions, workflow, assignment links and downloads
- `/api/alerts`, `/api/calendar`, `/api/notifications`
- `/api/analytics/*` and `/api/audit-logs`
- `/api/research/*`: projects, status and milestones
- `/api/document-reviews/*` and `/api/documents/*`: review, locks and retention
- `/api/settings/*`: status, SMTP test, system and user preferences

The FastAPI service has:

- `GET /api/health`
- `GET /api/engine`
- `POST /api/chat`
- `GET/POST /api/jobs`
- `POST /api/jobs/{job_id}/start`
- `PATCH /api/jobs/{job_id}/status`

There are no separate FastAPI routers. Major AI functions (`current_user`, `app2_context`, `document_text`, report generation, action proposal, and Ollama invocation) all reside in `app/main.py`.

## Existing tests and checks

No unit, integration, API, frontend component, end-to-end, authorization, retrieval, citation, model-evaluation, or prompt-injection test files were found.

Available checks are:

- Frontend `npm run build`: TypeScript project build plus Vite production build.
- Backend `npm run check`: Node syntax checks for `server.js` and `app.js` only.
- GitHub security workflow: frontend build, `npm audit --audit-level=high`, backend syntax check, backend `npm audit --audit-level=high`.
- CodeQL workflow: JavaScript/TypeScript analysis on pushes/PRs to `main` and weekly.
- Dependabot configuration.

The Python service has no formatter, linter, type checker, security scanner, dependency audit, or CI job in the inspected App2 repository.

## Security and reliability concerns

These are code-evidenced gaps, not automated-scan findings:

1. **Assignment comment read authorization:** `GET /api/assignments/:id/comments` authenticates the caller but does not call `canAccessAssignment`, unlike comment creation, history, attachments, and downloads. Any authenticated user who learns an assignment UUID can read its comments.
2. **Research milestone authorization:** `POST /api/research/:id/milestones` authenticates but does not check manager, lead, or collaborator access. Any authenticated user with a project UUID can add a milestone.
3. **Document lock authorization:** `POST /api/documents/:id/checkout` does not first apply `canReadKnowledge`; a caller with a UUID may create or replace an expired lock for a document they cannot read.
4. **Upload content trust:** upload controls rely on client-supplied MIME type and extension. There is no allowlist, signature detection, malware scan, quarantine, decompression limit, or safe parser isolation.
5. **Felix prompt injection:** extracted document content and live App2 text are concatenated into the model system prompt without explicit content delimiters, instruction neutralization, provenance objects, or injection detection. Documents and stored record text are therefore untrusted prompt inputs.
6. **Citation integrity:** references are display titles derived from context lines. They are not claim-linked citations and do not include document/version IDs, pages, sections, exact passage offsets, or support validation.
7. **Access metadata limitations:** documents do not have explicit access level or department visibility fields. Felix inherits existing App2 visibility, which is primarily published/owner/reviewer based and cannot express all required departmental restrictions.
8. **AI audit gap:** chats, retrieved passages, Ollama/tool usage, generated responses, proposed actions, validation outcomes, and research findings are not written to an immutable Felix audit trail. `research_events` covers only limited job lifecycle events.
9. **AI job visibility mismatch:** Reviewer users can list all AI research jobs, while the frontend does not expose AI Researcher navigation to Reviewers. The backend rule may be intentional but is not documented or tested.
10. **Schema change control:** automatic schema execution and ad hoc `ALTER` statements provide no ordered rollback-aware migration record, increasing deployment drift risk.
11. **Operational resilience:** external calls use timeouts but have no retry/circuit-breaker strategy; extraction errors are swallowed; background warm-up errors are ignored; service logging is minimal.
12. **Secret/config drift:** the AI settings accept `OLLAMA_MODEL`, but the checked-in example configuration does not list it. App2 Compose does not launch or configure the AI service, making production topology incomplete.
13. **No rate limiting:** authentication, password-reset, upload, and AI chat endpoints have no application-level throttling in the inspected code.
14. **No automated regression coverage:** resource permissions and workflow state transitions can regress without tests.

Positive controls already present include parameterized SQL, Zod/Pydantic input bounds, bcrypt hashing, JWT issuer/audience/version validation, live-session confirmation in the AI service, role middleware, path basename normalization, randomized stored filenames, raw-body size limits, Helmet, constrained CORS, transaction helpers, and audit records for a number of important App2 operations.

## Missing features relative to the Felix upgrade

- Refreshable App2 system manifest and system guide
- Repository discovery and incremental source index
- Git-aware App2 expert retrieval with file/function/line provenance
- Safe exclusion and secret scanning for repository indexing
- PDF/XLSX/PPTX extraction and page/section-preserving chunking
- Document access-level and department policy model
- Embedding generation, pgvector schema, similarity retrieval and hybrid ranking
- Passage-level citations and claim-to-citation validation
- Conflicting-evidence, confidence, limitations, and unsupported-evidence response structures
- Explicit fact/analysis/assumption/recommendation labeling
- Controlled code-review service, normalized findings, proposed patch and approval records
- Scheduled review jobs and persisted schedules/results
- Comprehensive Felix audit logging
- Felix administration dashboard and health/quality metrics
- Versioned evaluation dataset, scoring harness and promotion thresholds
- Unit, integration, permission, retrieval, injection-resistance and end-to-end tests
- API documentation/OpenAPI governance across both services
- Versioned database migrations

## Recommended implementation order

The requested sequence is sound, with security foundations placed before retrieval is exposed broadly:

1. **Document the system and generate a manifest.** Build a deterministic, secret-safe scanner and derive `app2-system-manifest.json` plus the human guide from current source.
2. **Establish migrations and tests.** Introduce a small ordered SQL migration mechanism and authorization regression tests before adding data models.
3. **Close existing resource-authorization gaps.** Fix and test comment reads, milestone creation, document checkout, and any additional ID-based route discovered during a systematic endpoint review.
4. **Build safe repository indexing.** Store repository/branch/commit/file/symbol metadata, hashes, and modification times; exclude secrets, dependencies, generated artifacts, uploads, and binaries; support incremental updates.
5. **Build secure document ingestion.** Add file allowlisting/signature checks, safe parser limits, PDF/DOCX/TXT and practical XLSX/PPTX extraction, page/section-aware chunks, explicit access metadata, and indexing job state.
6. **Add pgvector-compatible retrieval.** Use a configurable local embedding model, migrations, hybrid metadata/full-text/vector retrieval, and backend-enforced access predicates.
7. **Implement citation-grounded research.** Require structured passage provenance, claim mapping, citation validation, conflict detection, confidence and limitations before generation is treated as a research answer.
8. **Add App2 expert mode.** Retrieve the live manifest and current Git index; return repository, branch, commit, path, symbol and line evidence.
9. **Add controlled code review.** Run allowlisted tools without shell expansion, normalize evidence-backed findings, propose patches, require authorization, and audit every step.
10. **Add manual approvals and immutable audit records.** Separate proposal, approval and application permissions; never allow Felix to push, merge, deploy or mutate production by default.
11. **Add deterministic schedules and CI.** Configure commit, PR, nightly and weekly checks in CI/backend scheduling rather than prompts.
12. **Add the administration dashboard.** Expose health, index state, findings, schedules, approvals, metrics and audit data through administrator-only endpoints.
13. **Add and enforce evaluations.** Version datasets and thresholds for correctness, retrieval, citations, access control, review quality, latency and prompt-injection resistance.

## Phase 1 conclusion

App2 is a functional React/Express/PostgreSQL system with meaningful authentication, role checks, document workflow, audit events, and a separate authenticated FastAPI/Ollama service. Felix is currently an intent handler and lightweight live-context assistant, not yet a reliable retrieval-augmented research system, App2 source expert, or code-review platform. The highest-priority prerequisites are resource-level authorization tests/fixes, versioned migrations, safe document/repository ingestion boundaries, and provenance-preserving retrieval.
