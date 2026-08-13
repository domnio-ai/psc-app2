# Felix Phase 3: Repository Indexing

**Completed:** 2026-08-03

## Files created

- `scripts/index_repository.py`
- `../ai-research-service/app/services/repository_index.py`
- `../ai-research-service/app/services/__init__.py`
- `../ai-research-service/migrations/001_repository_index.sql`
- `../ai-research-service/tests/test_repository_index.py`

## Files modified

- `../ai-research-service/README.md`

## Database migration

Migration `001_repository_index.sql` was applied to the configured local Felix PostgreSQL database. It adds:

- `schema_migrations`
- `indexed_repositories`
- `repository_files`
- `repository_index_jobs`
- B-tree and GIN indexes for repository paths, hashes, routes and functions

No App2 production database or application data was changed.

## Indexed metadata

Each safe source file records repository, branch, commit (at repository level), path, content hash, language, file size, modification time, classes, functions, API routes, SQL/Pydantic models, React components, dependencies and test metadata.

The scanner excludes environment files, credentials, keys, tokens by filename/type, VCS internals, `node_modules`, virtual environments, build output, uploads, output artifacts, caches, binaries and files above the configured size limit. It does not store complete source contents.

Incremental behavior compares current SHA-256 hashes with stored hashes. Only additions and changed files are upserted; removed paths are deleted and unchanged paths are not rewritten. Each run records counts and status in `repository_index_jobs`.

## Configuration changes

No secrets or new required environment variables were added. The command uses the AI service's existing `DATABASE_URL`. The file-size limit defaults to 1,000,000 bytes and can be overridden with `--max-file-bytes`.

## Tests added and results

- Exclusion of `.env`, `node_modules` and binary files
- Extraction of functions, React components, API routes, SQL tables and test metadata
- Incremental detection of unchanged and changed files

All three tests passed. The App2 production build and backend syntax checks passed. The final database-backed scan indexed 75 safe files; its immediate verification run reported all 75 unchanged.

## Security concerns

- Regex-based symbol extraction is intentionally non-executing and safe, but it is less precise than language parsers for complex syntax.
- Repository-root authorization is currently an operator/CLI boundary. Before exposing indexing over an API, roots must be administrator-configured and canonical-path allowlisted in backend code.
- Indexed metadata must be filtered by repository access when expert and review endpoints are added.
- This phase does not execute linters, tests, shell commands or code from indexed repositories.

## Remaining work

- Add administrator-only indexing/status endpoints and job failure visibility.
- Add repository access policies for non-administrator expert queries.
- Add richer language parsers only where precision metrics justify them.
- Consume the index in App2 expert mode with live Git verification.
- Add repository-index audit events to the comprehensive Felix audit model.
