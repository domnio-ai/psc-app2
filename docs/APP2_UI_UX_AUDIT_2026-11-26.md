# APP2 UI/UX Audit — 26 November 2026

## Audit status

**Status:** In progress. Initial source and navigation audit completed; live visual inspection and end-to-end usability verification remain outstanding.

**Repository:** `domnio-ai/psc-app2`  
**Design branch:** `design/app2-modern-ui-2026-11-26-r2`  
**Design change:** Draft PR [#32](https://github.com/domnio-ai/psc-app2/pull/32)  
**Integration base:** `audit/research-milestone-task-integration-2026-11-26`

This is an evidence-based working register, not a claim that the full UI/UX audit is complete. Source inspection can establish structure, styles, labels and navigation logic. It cannot establish how the running application looks or behaves at real viewport sizes. A live APP2 preview is still required for visual sign-off.

## Design direction

- Light ivory and white surfaces.
- Restrained PSC-inspired gold for primary emphasis and selected states.
- Dark, readable body text and muted secondary text.
- Inter as the principal interface typeface.
- Consistent spacing, control heights, radii and focus treatment.
- A compact, predictable sidebar and top bar.
- Responsive layouts that preserve the primary action and record context.
- Avoid decorative gradients, heavy gold surfaces, excessive cards and dense information blocks.

## Confirmed source findings

| ID | Area | Finding and evidence | Priority | Status |
|---|---|---|---|---|
| UX-001 | Product identity | The audit found 279 legacy REDESY references across frontend and backend application source, spanning the shell, Felix AI, dashboard, document/repository readers, assignments, tasks, meetings, messaging, notifications, research, reviews, management reporting, email, PDF export and service messages. `index.html` also used REDESY in its title and description. | High | 279 frontend/backend source references and browser metadata updated on PR #32; application-copy scan passed, live visual verification outstanding |
| UX-002 | Navigation appearance | Executive Gold used a mustard sidebar (`#C5A24D`) and strongly tinted navigation controls (`#F9EFD2`). This made the navigation surface compete with the workspace. | Medium | Lightened on PR #32; awaiting visual verification |
| UX-003 | Shell proportions | The base desktop shell used a 345px sidebar and a 95px top bar. These dimensions consume substantial space before workspace content begins. | Medium | Refined on PR #32 to 272px and 76px respectively; awaiting responsive verification |
| UX-004 | Navigation taxonomy | `Documents` was a duplicate legacy entry in `navItems` and the Researcher role allowlist, while the visible sidebar already routes users to `Document Repository`. The route compatibility effect and navigation handler preserve `Documents` as a deep-link alias. | Medium | Sidebar duplicate removed from `navItems`; compatibility routing and workflow-level Documents tabs retained. Runtime navigation/permission regression verification still pending |
| UX-005 | CSS architecture | `src/app-styles.css` imports 96 stylesheets, including successive research/workspace refinements and multiple theme layers. This creates a large cascade surface and raises the risk of cross-module visual regressions. | High | Open — inventory ownership and consolidate safely with regression coverage |
| UX-006 | Theme consistency | The application exposes nine theme modes while Executive Gold is the default with Gold accent. Theme-specific palettes define navigation, card and interaction colours. | Medium | Open — visually audit all supported modes and define supported defaults |
| UX-007 | Runtime verification | No APP2 runtime or preview was open in the connected browser during this source audit. | Blocking verification | Blocked — open a running APP2 preview before visual sign-off |
| UX-008 | Application shell maintainability | `src/App.tsx` is approximately 727 KB and 16,271 lines, with 91 imports. This concentration of shell, navigation and module state makes visual changes harder to isolate and regression-test. | High | Open — plan a staged module extraction after current workflow integration stabilises |
| UX-009 | Styling architecture | `src/app-styles.css` imports 96 stylesheets. The cascade needs an ownership map and dependency review before any consolidation. | High | Open — staged CSS inventory and consolidation plan required |

## Positive foundations found in source

- Shared executive tokens define typography, semantic colours, radii, spacing, shadows and control sizing.
- Shared executive component styles cover cards, buttons, inputs, dialogs, tables and status pills.
- The shell includes a skip-to-main-content link.
- Keyboard focus-visible styling is present for buttons, links and form controls.
- The base stylesheet contains responsive breakpoints at 1300px, 850px and 560px.
- The application uses a central navigation model with role-based visibility checks.
- The legacy `Documents` route is redirected to the canonical `Document Repository` destination; this is retained for compatibility while the unused navigation item is reviewed.
- A CI branding guard now scans `src`, `backend/src` and `index.html` for the retired product name; the current branch passes.
- Workspace headers include breadcrumb navigation and contextual actions.

These are foundations to improve and standardise, not reasons to skip testing.

## Screen and workflow audit inventory

| Area | Source-level inspection | Live visual / interaction audit |
|---|---|---|
| Login, session and password recovery | Pending detailed review | Pending |
| Dashboard and Needs My Attention | Pending detailed review | Pending |
| Assignments and assignment reports | Pending detailed review | Pending |
| Tasks, delegation and reviews | Pending detailed review | Pending |
| Research workspace, milestones and deliverables | Pending detailed review | Pending |
| Research/document repository and evidence | Pending detailed review | Pending |
| Meetings, minutes and action tracking | Pending detailed review | Pending |
| Notices, audience selection and acknowledgements | Pending detailed review | Pending |
| Notifications and actionable deep links | Pending detailed review | Pending |
| Leave self-service, approvals and availability | Pending detailed review | Pending |
| Reports and management dashboards | Pending detailed review | Pending |
| Team and user administration | Pending detailed review | Pending |
| Documents, versions and retention | Pending detailed review | Pending |
| Settings, audit logs and administration | Pending detailed review | Pending |
| Felix / AI research surfaces | Pending detailed review | Pending |

## PR #32 — first visual-modernisation slice

The draft PR contains controlled changes to the APP2 application shell:

1. Replace legacy REDESY labels with APP2 in the main shell, dashboard workspace and Felix AI Researcher copy.
2. Update browser title and description metadata.
3. Lighten Executive Gold navigation surfaces and reserve gold for selection and interaction.
4. Refine shared shell proportions, typography and responsive content padding.
5. Ensure the extended security workflow runs for design branches and audit-base pull requests.

The visual changes do not intentionally alter workflow APIs, permissions, business rules or persisted data.

## Verification

- Source diff is limited to the APP2 shell, theme, shared executive component styles, browser metadata and CI trigger configuration.
- A PostgreSQL 17 migration integration failure was traced to the production runner omitting `baselineSql` from the migration-plan destructuring. The integration base already contains the correct baseline-loading implementation and regression assertion; PR #32 is based on that integration line rather than the stale branch that exposed the failure.
- GitHub Actions run [#45889500912](https://github.com/domnio-ai/psc-app2/actions/runs/45889500912) passed: Windows build/regression suite (1,394 tests: 1,389 passed, 5 skipped, 0 failed), Semgrep, Trivy, OSV, current-source Gitleaks, unprivileged frontend-container smoke test and PostgreSQL 17 production migration integration test.
- Full-history Gitleaks initially reported 45 `generic-api-key` matches in APP2 guard baseline and `before-hashes.json` snapshots. All 45 matched lines were verified at the historical commit as 64-character hexadecimal SHA-256 file fingerprints, not credentials. A path-and-pattern-specific allowlist was added without disabling the generic-api-key rule or excluding `.app2-guard`.
- GitHub Actions run [#45893113447](https://github.com/domnio-ai/psc-app2/actions/runs/45893113447) then passed all eight jobs: 1,394 regression tests (1,389 passed, 5 skipped, 0 failed), frontend container build and unprivileged smoke test, PostgreSQL 17 migration integration, Semgrep, Trivy, OSV, current-source Gitleaks and full-history Gitleaks.
- Browser visual/responsive verification remains outstanding.

## Next audit actions

1. Obtain a running APP2 preview and capture the dashboard and every major module at desktop, tablet and mobile widths.
2. Verify the sidebar, search, notification entry points, breadcrumbs, back navigation and deep links.
3. Review forms for grouping, validation, required-field clarity, unsaved changes and error recovery.
4. Review tables for density, sorting, filtering, pagination, empty states and mobile alternatives.
5. Test keyboard-only navigation, focus order, dialogs, labels, contrast and screen-reader landmarks.
6. Resolve the Documents / Document Repository naming and route ambiguity.
7. Map every workflow to its source record, permissions, state transitions, notifications, audit history and reports.
8. Build an ownership/dependency map for the 96 stylesheet imports and consolidate only with regression coverage.
9. Plan staged extraction from the 16,271-line `App.tsx`, preserving routes and state boundaries.
10. Remove the orphaned `Documents` nav item while retaining its compatibility redirect.
11. Repeat visual and functional checks after each module redesign.

## Completion rule

A screen is not marked complete until its visual design, interaction behaviour, responsive states, accessibility checks and connected workflow have all been verified against the running application. Source-level inspection alone is not visual sign-off.
