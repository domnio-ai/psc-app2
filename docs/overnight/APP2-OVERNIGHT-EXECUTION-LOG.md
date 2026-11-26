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

## Checkpoint 3 — research milestone to central assignment task

### Implemented
- Added `backend/migrations/045_research_milestone_task_links.sql` with nullable `research_milestones.task_id`, a foreign key to `assignment_tasks`, a unique partial index preventing one central task being linked to multiple milestones, and a project/task lookup index.
- Pinned the new migration in `production-migration-plan.js` with SHA-256 `A69F3A7219A16E658120FFC86E11F2D3C12785101D18CDE386B3EE3CA935C702`.
- Added the migration to development database setup and production migration-plan test expectations.
- Added authenticated link/unlink endpoints for existing tasks.
- Link validation requires research edit permission, task/assignment access, an assignment formally linked to the research project, an active task owner who is a research-team member, matching milestone/task owner, and current assignment membership.
- Duplicate milestone/task links are rejected and database uniqueness is enforced.
- Link/unlink writes research activity and audit records.
- Research list/detail milestone payloads now include linked task details and derive linked milestone status from the central task.
- Direct milestone status changes are rejected while linked; task workflow remains authoritative and task completion publication rules remain in force.
- Added API types and client methods.
- Added a task picker to the Research Work Plan using existing tasks from linked assignments; linked task progress is displayed and milestone status control is disabled while linked.
- Added source-contract regression tests for migration, permission, ownership, duplicate-link, central-status and UI wiring.

### Explicitly not yet implemented
- Creating a new central assignment task directly from a milestone. Current UI supports linking an existing task only.
- Full integration/e2e database-backed tests for the new link/unlink routes.
- Reporting/dashboard reconciliation for linked milestones.
- Full validation of the migration and frontend build on the latest branch head; CI must complete before this work unit is considered verified.

### Checkpoint 3 commits
- `cc8a257e9d06c271edc589b13c058580c2c54219` — milestone task-link migration.
- `c7419f66d3e27911643cf94d8a13d9df796b752b` — production migration pin.
- `1aa98c04191b49245e27b138b22810720054cab5` — development setup migration.
- `cf31dce2acb1d8bbdcbcc46d258bb39c4f0bb614` — production migration-plan test expectation.
- `05f567d6d51ff257e9c3cde3be34d51f2a766013` — governed backend link/unlink endpoints and authoritative status readback.
- `f77289d94931718bed458f645f42bf49ce7e40b4` — API types and methods.
- `4b34b761d06a2851be4f3e555a5495529f0b2f08` — backend source-contract tests.
- `b086b29f8ac3dec564778519033a3465facc2036` — linked task status display and status-control lock.
- `30e2c0064d01723c6fea36e97d3d32890fc46b2c` — existing-task picker.
- `1a5d0ad937aa3bac599ed46fa4fbf1e4a78b9f10` — App-level link/unlink handlers.
- `3c2d099bd4e20b67d5d2f0d27c5c3f942bfada34` — require active task owner.
- `38b39934738bbdac835b20ec17fc75c09de552d9` — UI regression assertions.
- `6501cb88da93ca5f340d63e30ae6cc7d198420c4` — require assignment access and owner alignment.
- `abcd571e4f8346aaf7446600c4a69d564c5b3870` — validation regression assertions.

### Next exact actions
1. Wait for CI on the latest branch head and fix any syntax, type, migration hash, or regression failures.
2. Add database-backed integration tests for successful link/unlink, duplicate task, wrong project assignment, inaccessible assignment, inactive/non-member owner, owner mismatch and task completion governance.
3. Add the approved "create task from milestone" flow by reusing central assignment task creation validation, reviewer selection, notifications, audit/history and report-publication controls.
4. Add linked milestone/task status and delivery metrics to management reporting.
5. Continue the research source, methods, evidence, dataset, review and repository publication audit.

## Checkpoint 4 — research repository evidence audit

### Verified existing implementation
- Research evidence linking is restricted to published, non-archived Repository documents.
- The API checks both research-project edit permission and Repository document read permission.
- Research evidence links are recorded in `research_knowledge_links` and cross-module traceability is mirrored in `repository_entity_links` within one transaction.
- Duplicate project/document links are prevented by the table primary key; repository entity relationships are unique by knowledge item, entity type and entity ID.
- Link and unlink operations record research activity and audit events.
- Research evidence UI selects only published, non-archived documents and explicitly tells users that linking does not copy, move or alter the source.
- Repository document versions remain separately recorded in `knowledge_versions`; repository relationships support a pinned version reference.
- Assignment evidence UI supports uploaded files plus links to Repository documents and previewing the linked source.

### Added
- Added `backend/test/research-repository-evidence-governance.test.js` to protect source publication/access checks, relationship uniqueness, version preservation, and research/assignment evidence UI contracts.

### Remaining audit questions
- Verify database-backed integration for research evidence link/unlink and access-control edge cases.
- Verify whether assignment report approval/publication always produces the intended repository record and preserves a stable source relationship and version.
- Verify repository sync outbox recovery for dead-letter/retry paths and source records updated during a pending sync.
- Verify pinned-version selection in the Repository UI and reader for evidence links, where a document is later revised.

### Checkpoint 4 commit
- `5ab96db3ac2694a1d44a9260d56eb477fe791f67` — research repository evidence governance regression tests.

### Next exact actions
1. Verify the latest Actions run and correct any failures before treating the feature as validated.
2. Inspect assignment report final publication and repository record creation end-to-end.
3. Add database-backed integration tests for evidence and milestone links.
4. Continue meetings/notices/notifications/leave/reporting audit after the research/repository integration is stable.
