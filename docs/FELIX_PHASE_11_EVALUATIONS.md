# Felix Phase 11 — Evaluation and Safety Gate

Phase 11 adds a versioned regression suite and a mandatory promotion gate for Felix model, prompt, retrieval, and indexing changes.

## Coverage

`evaluations/felix-eval-v1.json` contains 17 cases spanning architecture, workflows, permissions, database, API, research synthesis, citations, code review, security, prompt injection, access control, unsupported questions, and latency.

The gate measures answer correctness, retrieval relevance, citation correctness, unsupported-claim rate, access-control compliance, code-review precision and recall, p95 response time, and prompt-injection resistance. Every configured threshold must pass; access control and injection resistance require 100%.

## Run the gate

From `ai-research-service`:

```powershell
.\.venv\Scripts\python.exe scripts\run_evaluations.py --results evaluations\candidate-results.json --candidate '{"model":"model-version","prompt":"prompt-version","retrieval":"retrieval-version","index":"index-version"}'
```

The command writes `evaluations/latest-report.json` and exits with code `2` when promotion is blocked. Add `--persist` to record the run in PostgreSQL after migrations have been applied. CI and release automation must require exit code `0` before promoting a candidate.

## Backend safety boundary

Felix treats prompts, retrieved documents, repository content, and comments as untrusted. The backend refuses instruction overrides, hidden-prompt or credential disclosure, arbitrary command execution, permission escalation, unauthorized access, and production mutation before model or tool execution. UI controls are not a security boundary; App2 session and role checks remain backend-enforced.
