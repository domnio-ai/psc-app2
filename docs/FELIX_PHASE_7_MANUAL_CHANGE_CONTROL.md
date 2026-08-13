# Felix Phase 7: Manual Change Control

**Completed:** 2026-08-03

## Files created

- `../ai-research-service/migrations/004_manual_change_control.sql`
- `../ai-research-service/app/services/change_control.py`
- `../ai-research-service/tests/test_change_control.py`

## Files modified

- `../ai-research-service/app/main.py`
- `../ai-research-service/README.md`
- `src/api.ts`
- `src/App.tsx`
- `src/AIResearchChat.tsx`
- `src/felix-expert.css`

## Database migration

Migration `004_manual_change_control.sql` adds `change_proposals` and append-only `change_approval_events`, with explicit proposal and application states.

## Workflow

1. Run controlled Code Review Mode.
2. Select an evidence-backed finding with a bounded patch template.
3. Generate and inspect a unified diff.
4. Record the proposal with repository, branch, commit, file path and base SHA-256 hash.
5. Require a different Administrator to approve or reject with comments.
6. Keep the result explicitly `Not Applied`.

There is no application endpoint. Approval cannot edit files, commit, push, merge, deploy or touch production data.

## Security controls

- Repository paths are canonicalized and must remain inside the configured App2 root.
- Environment files and unavailable paths are rejected.
- Patch templates are code-defined and limited to supported evidence-backed authorization findings.
- Patch generation uses in-memory text and unified diff generation; the original file remains unchanged.
- Research Officers and Reviewers cannot create proposals.
- Only Administrators can decide proposals.
- Proposers cannot approve their own proposals.
- Every proposal and decision records actor, time, comments and details.

## UI

Code-review findings expose **Propose patch** when supported. The Manual Approvals panel shows patch text, status, application status, proposer and decision controls. Approval comments are mandatory and the interface states that approved proposals remain Not Applied.

## Tests and validation

- Patch generated without source mutation
- Self-approval rejected
- Non-administrator approval rejected
- Independent administrator approval allowed
- Repository path escape rejected
- Complete Felix suite: 16 tests passed
- Backend syntax checks passed
- App2 production build passed

## Remaining work

- A separately authorized application stage with stale-hash verification and mandatory tests
- Scheduled reviews
- Comprehensive Felix audit consolidation
- Administration dashboard
- Versioned evaluation dataset

