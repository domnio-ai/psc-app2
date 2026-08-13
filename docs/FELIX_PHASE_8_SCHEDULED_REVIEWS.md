# Felix Phase 8: Scheduled Reviews

Phase 8 adds deterministic, configurable review automation without allowing Felix to mutate the repository.

## Review profiles

- **Commit:** whitespace/format checks, backend syntax, TypeScript, test readiness, secret patterns, and basic security findings.
- **Pull Request:** diff, requirements, permissions, migrations, API compatibility, frontend/backend consistency, security, coverage, and documentation impact.
- **Nightly:** complete build/check suite, offline dependency audits, static security analysis, and failed-check reporting.
- **Weekly:** code quality, security, technical debt, untested modules, performance risks, and documentation drift.

## Scheduling and execution

Configuration is stored in `scheduled_review_jobs`; results are stored in `scheduled_review_runs`. Nightly and weekly jobs are polled by the Felix backend every minute. Commit and pull-request profiles are event driven through `.github/workflows/felix-scheduled-reviews.yml`. Administrators may configure jobs and administrators or research managers may run a profile manually through the authenticated API.

Endpoints:

- `GET /api/scheduled-reviews`
- `PATCH /api/scheduled-reviews/{job_id}`
- `POST /api/scheduled-reviews/{job_id}/run`

All command arguments are fixed arrays, shell execution is disabled in Felix, and review jobs do not edit files, apply patches, commit, push, merge, deploy, modify permissions, or change production data.
