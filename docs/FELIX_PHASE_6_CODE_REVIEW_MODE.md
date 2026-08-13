# Felix Phase 6: Controlled Code Review Mode

**Completed:** 2026-08-03

## Files created

- `../ai-research-service/migrations/003_code_review.sql`
- `../ai-research-service/app/services/code_review.py`
- `../ai-research-service/tests/test_code_review.py`

## Files modified

- `../ai-research-service/app/main.py`
- `../ai-research-service/README.md`
- `src/api.ts`
- `src/AIResearchChat.tsx`

## Database migration

Migration `003_code_review.sql` adds:

- `code_review_runs`
- `code_review_tool_results`
- `code_review_findings`
- Supporting run/finding indexes

Findings store ID, severity, confidence, category, repository, branch, commit, path, line range, evidence, description, impact, recommended correction, optional proposed patch, suggested tests and review status.

## Safe execution controls

The Basic review profile runs only fixed, code-defined argument arrays with Python `subprocess.run(..., shell=False)`:

- `git diff --check`
- Node syntax check for `backend/src/app.js`
- Node syntax check for `backend/src/server.js`
- TypeScript project compiler

User prompts cannot supply executables, arguments, paths or shell fragments. Each command has a timeout and bounded captured output. Code Review Mode is restricted to Administrators and Research Managers before tools execute.

No files are edited. Proposed patches are deliberately `null`; commits, pushes, merges, deployments, permission changes and production-data operations are unavailable.

## Evidence-backed initial findings

The controlled review produced four source-evidenced findings:

- High: assignment-comment read route lacks assignment resource authorization.
- High: research-milestone creation lacks manager/participant authorization.
- Medium: document checkout lacks document-read authorization.
- Medium: uploads trust client MIME metadata and write bytes without signature or malware validation.

All configured command checks passed. These findings are proposals for review, not automatically applied corrections.

## Tests

Tests verify exact-evidence finding generation, absence of proposed patches, and backend denial before tool execution for an ordinary Research Officer. The complete Felix suite contains 13 passing tests.

## Remaining work

- Manual approval and patch lifecycle
- Broader optional tools such as ESLint, Bandit/Semgrep/Gitleaks where installed and explicitly allowlisted
- Dependency audit result normalization
- Scheduled commit, pull-request, nightly and weekly reviews
- Felix administration dashboard
- Comprehensive audit logging and evaluation thresholds

