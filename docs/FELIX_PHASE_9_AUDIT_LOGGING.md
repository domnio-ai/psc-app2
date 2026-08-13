# Felix Phase 9: Audit Logging

Phase 9 adds a canonical, append-only audit trail for significant Felix actions.

## Captured fields

Every event includes the actor and timestamp, operating mode, query, retrieved document and code evidence, repository identity, tools and test results, generated response, findings, proposed patches, approval action, final outcome, and structured metadata.

Instrumented workflows include:

- Felix chat in Auto, Research, App2 Expert, and Code Review modes
- Controlled tools, tests, findings, and repository evidence
- Scheduled and manually triggered Phase 8 reviews
- Patch proposal creation
- Independent approval or rejection decisions
- Research review decisions

## Immutability and access

`felix_audit_events` is append-only. PostgreSQL triggers reject `UPDATE` and `DELETE`, while `TRUNCATE`, `UPDATE`, and `DELETE` privileges are revoked from `PUBLIC`. The service exposes only a read endpoint—there is no audit mutation endpoint.

Only Administrators and Research Managers can read `GET /api/audit-events`. Results support pagination and filters for operating mode, event type, and final outcome.

Felix does not report an audited workflow as successful until its audit event has been appended. This fails closed when audit storage is unavailable.
