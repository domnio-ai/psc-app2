# Felix Phase 5: App2 Expert Mode

**Completed:** 2026-08-03

## Files created

- `../ai-research-service/app/services/system_expert.py`
- `../ai-research-service/tests/test_system_expert.py`
- `src/felix-expert.css`

## Files modified

- `../ai-research-service/app/main.py`
- `../ai-research-service/.env.example`
- `../ai-research-service/README.md`
- `src/api.ts`
- `src/App.tsx`
- `src/AIResearchChat.tsx`
- `src/main.tsx`

## Behavior

The Felix interface now exposes Auto, Research and App2 Expert modes. Expert Mode combines the generated manifest with live, secret-safe repository inspection and current Git metadata. It can retrieve evidence for modules, workflows, API routes, database tables/models, React components, permissions, tests and recent commits.

Every evidence reference contains repository, branch, commit, file path, symbol or API route, and practical line range. Recent-change questions also receive current `git log` evidence. If the repository does not support an answer, Felix is instructed to state that evidence is insufficient rather than invent details.

## Access control

The FastAPI backend restricts Expert Mode to `Administrator` and `Research Manager`. Research Officers and Reviewers receive HTTP 403 before repository configuration or content is accessed. Frontend labels explain the restriction, but backend enforcement remains authoritative.

Expert Mode is read-only. It does not run repository code, execute commands from prompts, modify files, generate applied patches, push, merge or deploy. Repository files, source comments, commit messages and user questions are explicitly treated as untrusted evidence.

## Configuration

- `APP2_REPOSITORY_PATH=../app2`
- Existing `APP2_MANIFEST_PATH` remains the manifest location.

## Tests

Tests verify:

- Live branch/commit provenance
- Relevant API evidence retrieval
- Environment-file exclusion
- Manifest loading and formatted line evidence
- Backend denial for an ordinary Research Officer

The complete Python suite, backend syntax checks and App2 production build pass.

## Database migrations

None. Expert Mode uses the existing repository index architecture and verifies source evidence against the live worktree and Git state.

## Remaining work

- Controlled code-review findings and tool execution
- Manual patch approval workflow
- Scheduled reviews
- Comprehensive Felix audit records
- Administration dashboard
- Versioned evaluation dataset and promotion thresholds

