# Felix Phase 10: Administration Dashboard

Phase 10 adds **Felix Administration** to the authenticated App2 navigation for Administrators and Research Managers.

The dashboard reads `GET /api/admin/overview` and presents:

- Ollama availability and current model
- Indexed documents, chunks, repositories, current branch and commit
- Last indexing time and failed indexing jobs
- Research job and citation-validation quality metrics
- Code-review and security findings
- Dependency alerts and automated test results
- Phase 8 review schedules and recent runs
- Pending Phase 7 approvals, always showing application state
- Recent immutable Phase 9 audit events

The endpoint independently enforces the Administrator/Research Manager role. Research Officers and Reviewers neither receive the navigation item nor pass backend authorization.

The page follows App2's existing dark PSC design system, supports responsive two-column and mobile layouts, provides explicit empty/error/loading states, and includes a manual refresh control. Global Felix availability now refreshes after authentication so the floating status badge agrees with the administration health view.
