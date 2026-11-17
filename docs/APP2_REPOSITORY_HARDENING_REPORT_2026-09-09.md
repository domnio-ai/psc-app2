# APP2 Repository Hardening Report

Date: 9 September 2026  
Repository: `app2` / REDESY  
Baseline branch: `app2-test-checkpoint-2026-08-17`  
Baseline commit: `8e58c3a`

## A. Executive Summary

The repository was functional and well covered by domain-contract tests, but accumulated implementation layers had left three material maintainability risks: a 15,298-line `App.tsx`, a backend `app.js` containing 211 HTTP routes, and 96 global CSS imports that compile to a 1.26 MB stylesheet. The initial worktree also contained 2,845 untracked artifacts, primarily nested checkpoints and backups, which caused Windows path-length warnings during Git inspection.

This hardening pass preserved the current workflows and data model while reducing `App.tsx` to 14,936 lines, moving document-display and report-sanitization concerns into focused utilities, removing all compiler-confirmed unused frontend declarations, correcting the shared Tiptap extension registration, restoring visible report-builder error feedback, applying a repository review permission guard, reducing the main JavaScript bundle from 1,278.31 KB to 805.49 KB, and removing all high-severity production dependency advisories. No database data, schema, RBAC rule, API contract, workflow transition, theme, or approved visual design was removed.

Release status: **ready for controlled acceptance testing**, with the remaining high-coupling and CSS debt listed below. A fully authenticated manual role-by-role UI test still requires test credentials and was not performed during this pass.

## B. Modularisation Findings

| Area | Finding | Risk |
| --- | --- | --- |
| `src/App.tsx` | 14,936 lines, 173 state hooks at baseline, and cross-domain orchestration for authentication, dashboards, assignments, research, repository, users and settings. | HIGH |
| `backend/src/app.js` | 5,601 physical lines, 211 routes, 783 query calls and 104 transaction calls. Reports are modular, but most other domains remain co-located. | HIGH |
| `src/api.ts` | 3,555 lines in one API/type surface. The `api` object limits tree-shaking and couples all domains to one client module. | MEDIUM |
| CSS entry | 96 global CSS imports; multiple selectors are overridden across historical phase files. The compiled main CSS is 1,264.67 KB. | HIGH |
| Reports | Frontend and backend already have useful module boundaries, but the main reports module remains about 1,019 lines and loads 105.94 KB of feature CSS. | MEDIUM |
| Database | 61 tables and 71 indexes are managed through a large schema/setup path without a clearly versioned migration chain. | MEDIUM |
| Git artifacts | Nested checkpoint trees and backup directories created 2,845 untracked files and path-length warnings. | MEDIUM |
| Runtime graph | 284 of 295 TypeScript/JavaScript/CSS files are reachable from `main.tsx`. Ten runtime-unreachable candidates remain after excluding `vite-env.d.ts`; several are compatibility barrels or historical style assets and were not blindly deleted. | LOW/MEDIUM |

## C. Changes Made

| Files | Change and architectural benefit | Regression risk | Validation |
| --- | --- | --- | --- |
| `src/utils/documentDisplay.ts`, `src/App.tsx` | Extracted file-name decoding, document-title formatting and document normalization into one reusable document utility. | Low | TypeScript build, strict unused scan, 373 tests. |
| `src/modules/research/utils/safeReportSectionHtml.ts`, `src/App.tsx` | Moved Research preview sanitization into the Research domain while retaining the same allow-list and escaping behaviour. | Low/medium | Production build and Research/report contracts. |
| `src/App.tsx` | Removed obsolete analytics polling/CSV implementation superseded by the governed Reports module, plus compiler-confirmed unused state, imports and derived dashboard calculations. | Medium | Strict unused scan and full regression suite. |
| `src/modules/report-builder/core/editorExtensions.ts` | Registered the existing `App2TextStyle` and `App2Image` extensions instead of the generic extensions. This restores the intended font-size and image-width/alignment schema. | Medium | Editor foundation, HTML bridge, image and report-builder tests. |
| `src/modules/research/components/ResearchReportWorkspace.tsx` | Rendered the existing report action status/error state through an accessible live region. | Low | TypeScript and report-builder tests. |
| `src/modules/repository/components/RepositoryReviewQueue.tsx` | Applied the supplied `canReview` permission to the review action so the UI no longer presents an actionable review control to an ineligible user. Backend authorization remains authoritative. | Low | Repository/RBAC contracts and build. |
| `src/modules/assignments/components/TaskSectionWorkspace.tsx` | Preserved and used the selected reviewer/report-structure derivations in submission readiness, instead of retaining dead contract-only declarations. | Low | Phase 4F submission-readiness tests. |
| `src/modules/reports/pages/InstitutionalReportsDashboard.tsx` | Reused `detailValue` for timezone-aware generated-at display and removed an unused lifecycle filter. | Low | Reports formatting and intelligence tests. |
| `vite.config.ts` | Split Tiptap/editor dependencies into an editor vendor chunk and PDF.js into a PDF vendor chunk. | Low | Production build and bundle inspection. |
| `backend/package.json`, `backend/package-lock.json` | Updated Nodemailer from 9.0.5 to 9.1.1, removing the high-severity advisory set. | Low | Backend syntax, 373 tests, follow-up `npm audit`. |
| `.env.production.example`, `docker-compose.yml` | Documented production origin, Felix, storage, SSL and SMTP settings; added API health gating for the web container and an explicit host route for the separate Felix service. | Medium | YAML parse passed; Docker runtime unavailable locally. |
| `.gitignore` | Classified and ignored generated checkpoints, recovery copies, diagnostics, output and historical backup patterns without deleting them. | Low | Git status/count inspection. |
| `scripts/audit-import-graph.mjs` | Added a repeatable static/dynamic import reachability audit from `src/main.tsx`. | Low | Script reports 284 reachable and 11 unreachable files including the Vite declaration. |

## D. Dead Code Removed

- Removed unused App imports for legacy analytics, retired Research progress/Felix panels and an unused task-request type.
- Removed unused App state for superseded assignment-member controls, task-section saving, research document filters, builder creation controls and reviewer-saving controls.
- Removed the obsolete App-level analytics request and CSV exporter already replaced by the governed Reports module.
- Removed unused dashboard deadline cards, monthly completion aggregation, alternate attention list, and local workload aggregation superseded by the current dashboard API model.
- Removed unused component locals and imports in Assignments Portfolio, Assignment Workflow Guide, Task Section Workspace, Team Member Coverage, Institutional Reports, Research Source Choice and Notice Board.
- No file identified only by static reachability was deleted. Compatibility barrels and historical style candidates remain pending targeted visual validation.

## E. Duplication Removed

- Document file-name normalization now has one implementation in `src/utils/documentDisplay.ts`.
- Research report HTML sanitization now has one domain-owned implementation.
- The legacy App analytics/CSV path was removed so governed Reports APIs and export controls remain the sole active reporting path.
- The existing custom editor extensions are now the single active implementation for report text-style and image metadata.

## F. Regression Results

| Module or workflow | Result | Evidence |
| --- | --- | --- |
| Production frontend build | PASS | Vite build completed; 377 modules transformed. |
| TypeScript strict compilation | PASS | `tsc --noEmit --noUnusedLocals --noUnusedParameters` returned zero findings. |
| Backend syntax | PASS | `npm run check`. |
| Automated regression suite | PASS | 373/373 tests passed. |
| API and database health | PASS | `/api/health` returned HTTP 200 and `database: connected`. |
| Login screen rendering | PASS | Live Chrome smoke check rendered the REDESY member-access page. |
| Authentication/session/logout contracts | PASS | Automated authentication, password and session contract coverage. |
| Manager/researcher dashboards and navigation | PASS | Dashboard scope/navigation contracts and production compilation. |
| Assignment creation, task ownership, reviewer and status progression | PASS | Assignment/task workflow and immutable-version tests. |
| Research Work, Evidence, Report, Review, Activity and final publication | PASS | Research lifecycle, reviewer, lock and publication tests. |
| Repository upload, review, publication, access and audit | PASS | Reader, upload, RBAC, repository and audit contracts. |
| Reports, graphs, scope, schedules and PDF/DOCX/XLSX export | PASS | Reporting suites, including comprehensive PDF footer regression. |
| Notifications and action navigation | PASS | Notification state, persistence and routing tests. |
| Themes and persistence | PASS | Theme contract tests and production build. |
| Felix health and database | PASS | Felix `/api/health` returned HTTP 200 and `database: connected` after service restart. |
| Authenticated role-by-role visual walkthrough | NOT TESTABLE | No test password was supplied; credentials were not requested or fabricated. |
| Docker image/Compose startup | NOT TESTABLE | Docker executable is not installed. Compose YAML parsing passed independently. |

## G. Remaining Technical Debt

| Severity | Item | Recommendation |
| --- | --- | --- |
| HIGH | `App.tsx` remains a 14,936-line orchestration component. | Extract one domain controller at a time, beginning with Repository or Settings, behind unchanged props and contract tests. |
| HIGH | `backend/src/app.js` still owns 211 routes. | Repeat the proven Reports pattern for settings, notifications, repository, assignments and research; inject existing auth/scope/query services without changing SQL or policies. |
| HIGH | Global CSS is 1.26 MB with 96 entry imports and patch-on-patch overrides. | Produce selector ownership snapshots per screen/theme, then consolidate only selectors proven equivalent through visual regression. |
| MEDIUM | `src/api.ts` is a 3,555-line monolith. | Split types and API methods by domain while retaining a compatibility export during migration. |
| MEDIUM | No versioned database migration chain is evident. | Introduce forward-only numbered migrations and record applied versions before further schema work. |
| MEDIUM | Main JavaScript remains 805.49 KB and triggers Vite's 500 KB warning. | Lazy-load additional Research/Repository workspace surfaces and split App orchestration after adding browser tests. |
| MEDIUM | Ten runtime-unreachable candidates remain, including two unused components and five historical report-builder CSS files. | Validate each against contract tests and visual snapshots before deletion. |
| LOW | Source contains known mojibake compatibility mappings and some already-corrupted literals. | Normalize source encoding in a dedicated, separately tested change; do not remove runtime compatibility until stored data is audited. |

## H. Security Findings

- Frontend production dependencies: **0 known advisories**.
- Backend before remediation: one high and two moderate findings. After Nodemailer 9.1.1: **0 high, 2 moderate**.
- The remaining advisory is `uuid@8.3.2` through `exceljs@4.4.0`. npm offers only a breaking ExcelJS downgrade. Current ExcelJS code uses `uuid.v4()` without the vulnerable supplied-buffer path described for v3/v5/v6, so the practical exposure appears limited; retain as monitored residual risk rather than forcing an incompatible override.
- Helmet, origin allow-listing, production login-directory suppression, JWT authentication, backend RBAC/scope checks, Zod validation, bounded raw uploads and parameterized database values remain present.
- Static secret-pattern scanning found no embedded production credential or private key in application source. Production placeholders remain explicit in the example environment file.
- No authorization was moved from backend to frontend. The repository UI guard is additive to backend enforcement.

## I. Performance Findings

- Main JavaScript reduced from 1,278.31 KB (362.90 KB gzip) to 805.49 KB (213.51 KB gzip), approximately 37% smaller uncompressed and 41% smaller compressed.
- Tiptap/editor code is now isolated in a 471.26 KB vendor chunk; PDF.js remains isolated in a 434.00 KB vendor chunk.
- Reports, task workspaces, readers, calendar, notifications and Felix admin already use lazy feature chunks.
- The main stylesheet remains the largest immediate frontend cost at 1,264.67 KB (171.62 KB gzip).
- Vite still reports that `App2ReportEditor` is both statically and dynamically imported. Converting the Research editor surface to a fully lazy boundary is recommended only with authenticated browser regression coverage.
- No new polling, network calls or database queries were introduced.

## J. Recommended Next Architectural Steps

1. Add Playwright browser tests with dedicated non-production accounts for Administrator, Director/manager, researcher and reviewer roles.
2. Extract backend Settings and Notifications route registrars first; they are smaller than the core Assignment/Research domains and provide a low-risk template.
3. Split `src/api.ts` into domain clients and shared transport/error handling while preserving the current `api` compatibility export.
4. Move Repository orchestration out of `App.tsx`, followed by Research orchestration, with one extraction per verified batch.
5. Establish CSS ownership by module and theme, capture visual baselines, then retire historical phase CSS in evidence-backed batches.
6. Add versioned database migrations and a migration status check to deployment health.
7. Re-run `node scripts/audit-import-graph.mjs`, strict TypeScript, dependency audit, production build and all tests after every extraction batch.

## Acceptance Gate

All automated acceptance requirements pass. Live API, database and Felix health pass. The only incomplete acceptance evidence is authenticated manual UI coverage and Docker runtime execution, both explicitly recorded as **NOT TESTABLE** rather than assumed.
