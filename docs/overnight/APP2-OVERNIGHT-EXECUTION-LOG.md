# APP2 Overnight Execution Log

## Checkpoint 2026-11-25 — baseline inspection

- Repository: `domnio-ai/psc-app2`
- Branch: `features/meeting-action-task-link-2026-11-25`
- Verified branch HEAD: `fa9243287c2667c082d9de805af62d68b62b3fad`
- Latest workflow run: [45675745088](https://github.com/domnio-ai/psc-app2/actions/runs/45675745088) — completed successfully.
- Required jobs observed as successful: Windows build/regression tests, Trivy filesystem/configuration scan, OSV dependency scan, Gitleaks current-source scan, frontend container build/smoke test, Semgrep SAST.
- Full Git-history Gitleaks audit was skipped (not counted as passed).
- No open pull request was found for the designated branch in the connected GitHub search.
- No production merge or deployment performed.

## Findings

### Research milestone / central task integration
- `research_milestones` currently stores project, title, description, owner, due date, priority and its own status.
- No task foreign key exists in the current milestone schema.
- Research projects already support multiple assignment links through `research_assignment_links`.
- `assignment_tasks` are governed centrally through the assignment task API.
- Task creation requires an Assignment Lead or authorised manager, validates active owner and assignment membership, applies reviewer eligibility checks, writes notifications and audit/history records.
- Direct task completion is rejected; completion is governed by accepted final Task Report and Repository publication.
- Current research milestone PATCH permits setting `Completed` independently. This must be prevented for a milestone once it is linked to a central task.
- Research project list/detail queries currently return milestone data but no linked-task metadata.
- Research work-plan panel currently shows milestone fields/status without central task linkage controls.

### Migration integrity items requiring correction
- `backend/src/production-migration-plan.js` lists `20261125_03_meeting_action_task_links.sql` twice.
- `backend/src/setup-database.js` applies that migration twice.
- Production migration plan pins each migration by SHA-256 and validates source bytes. A new migration must be added to the manifest with a correctly computed hash.
- The manifest's recorded SHA for `019_research_reviewers_assignments.sql` remains protected by the production loader's built-in SHA-256 validation. A GitHub blob SHA is not the same as the manifest's SHA-256; an earlier comparison of those identifiers was invalid and did not establish a mismatch.
- Current development setup has two sequential reads of the same meeting-action migration.
- The existing production migration plan test expects both the manifest entries and embedded meeting migration. Update its expectations if correcting duplicate registration.
- Do not modify historical migration pins until hashes are locally computed and independently verified.

## Changes in checkpoint 2
- Removed the duplicate `20261125_03_meeting_action_task_links.sql` entry from the pinned production migration manifest.
- Removed the duplicate application of that migration from development database setup.
- Added regression assertions that production migration IDs are unique and the meeting-action migration appears exactly once.
- The production migration plan test uses Node's own SHA-256 implementation to validate the pinned sources when CI runs.
- No application feature logic or database migration was executed or changed in this checkpoint.

## Next exact actions
1. Use a local repository/runtime with a trusted SHA-256 utility to calculate LF/CRLF hashes for each pinned migration and compare with the manifest.
2. Correct duplicate meeting-action migration registration in the production plan and development setup, with regression coverage.
3. Create a new research milestone task-link migration with unique nullable `task_id`, FK to `assignment_tasks`, uniqueness preventing a task being linked to multiple milestones unless product rules are explicitly changed, and suitable indexes.
4. Extend research project list/detail queries with linked task details.
5. Add authenticated APIs to link/unlink a milestone to an existing task, validating project access, research-team owner membership, research-assignment linkage, task-assignment membership and task access.
6. Reject direct milestone completion while linked task is incomplete; derive linked milestone status from central task status without bypassing final report publication.
7. Add UI controls to display/link/unlink existing tasks and show linked task progress in Research Work Plan.
8. Add regression tests for duplicate links, cross-project/task assignment mismatches, invalid ownership, permission failures, linked completion guard and approved final publication.
9. Add the new migration to the pinned production migration plan with verified SHA-256; update production migration plan tests.
10. Run full backend tests, frontend build, migration plan tests, security scans and branch CI; record actual results.

## Safety constraints
- Do not merge into `main`.
- Do not deploy.
- Do not run destructive Git operations.
- Do not alter user data or execute production migrations as part of this branch task.

## Checkpoint 2 commits
- `23ad3cf99e828a54873ba462ef2d181ccf14b350` — remove duplicate meeting migration pin.
- `4e003447d0a98f7251569ab7313d9cbae0171322` — apply meeting migration once in development setup.
- `3657ec7bcfd401e2c33202cd472c3af3a974f5b1` — assert migration manifest IDs are unique.
