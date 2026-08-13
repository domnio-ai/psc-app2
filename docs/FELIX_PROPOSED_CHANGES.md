# Proposed Felix File and Database Changes

**Status:** proposal only; no schema or runtime changes have been applied.

This change map translates the architecture gaps into an incremental implementation that preserves the React, Express, FastAPI, PostgreSQL, and Ollama foundations.

## Proposed files

### System knowledge and indexing

- `scripts/build_app2_manifest.py`: deterministic, secret-safe manifest generator.
- `docs/app2-system-manifest.json`: generated machine-readable system description.
- `docs/APP2_SYSTEM_GUIDE.md`: human guide generated from the manifest.
- `scripts/index_repository.py`: later incremental repository index command.
- `ai-research-service/app/services/repository_index.py`: repository metadata and symbol indexing.
- `ai-research-service/app/services/system_expert.py`: manifest and live Git evidence retrieval.

### Research retrieval

- `ai-research-service/app/services/document_extractors.py`: bounded PDF, DOCX, TXT, XLSX and PPTX extraction.
- `ai-research-service/app/services/chunking.py`: page/section-preserving chunks.
- `ai-research-service/app/services/embeddings.py`: configurable local Ollama embeddings.
- `ai-research-service/app/services/retrieval.py`: access-filtered hybrid retrieval.
- `ai-research-service/app/services/citations.py`: claim/citation support validation.
- `ai-research-service/app/prompts/`: versioned prompts that clearly delimit untrusted content.

### Review, approval and audit

- `ai-research-service/app/services/code_review.py`: allowlisted tool execution and normalized findings.
- `ai-research-service/app/services/approvals.py`: proposal/approval/application state machine.
- `ai-research-service/app/services/schedules.py`: deterministic review schedules.
- `ai-research-service/app/services/felix_audit.py`: append-only Felix activity logging.
- `.github/workflows/felix-review.yml`: commit, pull-request, nightly and weekly review jobs.

### API, UI and tests

- FastAPI routers under `ai-research-service/app/routers/` for research, expert, indexing, review, approvals and administration.
- Administrator-only Felix status endpoints in the AI service, with App2 identity and role validation.
- App2 frontend administration components under `src/felix-admin/` following existing styles.
- Python unit/integration/evaluation tests under `ai-research-service/tests/`.
- Express authorization regression tests under `backend/test/`.
- Frontend component/API contract tests under `src/**/*.test.tsx` and `src/**/*.test.ts`.
- `evaluations/felix/` for versioned datasets, thresholds and results schemas.

## Proposed database migrations

The following are planned as ordered, reversible migrations rather than edits applied directly to the current schema:

1. Enable `vector` where available and record embedding configuration/version.
2. Add document access metadata: access level, owning department, source location and indexing state.
3. Add document chunks with document/version ID, page, section, extracted text, content hash and embedding.
4. Add repositories, repository files, symbols, routes, dependencies and incremental-index job tables.
5. Add code-review runs, findings, proposed patches, tool results and review status.
6. Add approval requests and decisions, separating proposer, approver and applier.
7. Add deterministic review schedules and job runs.
8. Add append-only Felix audit events containing retrieved document/code identifiers, tools, response, findings, patches, approvals, tests and outcome.
9. Add research-answer and citation-validation metrics needed by the administration dashboard and evaluations.

No secret values or raw credentials will be stored in these tables. Large file bodies and generated patches should use bounded storage with hashes and retention rules.

## Proposed configuration names

- `OLLAMA_EMBED_MODEL`
- `FELIX_RETRIEVAL_LIMIT`
- `FELIX_CHUNK_SIZE`
- `FELIX_CHUNK_OVERLAP`
- `FELIX_REPOSITORY_ROOTS`
- `FELIX_INDEX_MAX_FILE_BYTES`
- `FELIX_REVIEW_TOOLS`
- `FELIX_SCHEDULE_ENABLED`
- `FELIX_AUDIT_RETENTION_DAYS`
- `PGVECTOR_REQUIRED`

Defaults will be safe and local. Values will be documented in `.env.example`; secrets will remain environment-only.

## Preconditions

- Add versioned migrations and rollback guidance.
- Fix and test the existing resource-level authorization gaps identified in the architecture report.
- Establish upload allowlists, signature checks, parser limits and quarantine behavior.
- Establish evaluation thresholds before promoting a model, prompt, embedding model or retrieval configuration.

