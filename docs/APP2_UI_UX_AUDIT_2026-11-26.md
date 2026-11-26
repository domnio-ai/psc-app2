# APP2 UI/UX Audit — 26 November 2026

## Audit status

**Status:** In progress — initial source and navigation audit completed; live visual inspection and end-to-end usability verification remain outstanding.

**Repository:** `domnio-ai/psc-app2`  
**Audit branch:** `design/app2-modern-ui-2026-11-26`  
**Design change:** Draft PR [#30](https://github.com/domnio-ai/psc-app2/pull/30)

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
| UX-001 | Product identity | The application shell contained 48 occurrences of the legacy name REDESY in `src/App.tsx`; `index.html` also used REDESY in its title and description. | High | Implemented on PR #30; awaiting automated and visual verification |
| UX-002 | Navigation appearance | Executive Gold used a mustard sidebar (`#C5A24D`) and strongly tinted navigation controls (`#F9EFD2`). This made the navigation surface compete with the workspace. | Medium | Lightened on PR #30; awaiting visual verification |
| UX-003 | Shell proportions | The base desktop shell used a 345px sidebar and a 95px top bar. These dimensions consume substantial space before the workspace content begins. | Medium | Refined on PR #30 to 272px and 76px respectively; awaiting responsive verification |
| UX-004 | Navigation taxonomy | `Documents` appears in `navItems` and role-navigation definitions but is absent from the displayed `navGroups`. The navigation helper also maps `Documents` to `Document Repository`. The two names therefore do not represent distinct sidebar destinations in this implementation. | Medium | Open — decide and implement one authoritative label/destination |
| UX-005 | CSS architecture | `src/app-styles.css` imports 96 stylesheets, including multiple successive research/workspace refinements and several theme layers. This creates a large cascade surface and raises the risk of cross-module visual regressions. | High | Open — inventory ownership, consolidate safely and retain regression coverage |
| UX-006 | Theme consistency | The application exposes nine theme modes while the default is Executive Gold with Gold accent. Several theme palettes define their own navigation, card and interaction colours. Cross-theme consistency needs visual review. | Medium | Open — audit all supported modes and agree which are supported defaults |
| UX-007 | Runtime verification | No APP2 runtime or preview was open in the connected browser during this source audit. | Blocking verification | Blocked — provide/open a running APP2 preview before visual sign-off |

## Positive foundations found in source

- A shared executive token file already defines typography, semantic colours, radii, spacing, shadows and control sizing.
- Shared executive component styles cover cards, buttons, inputs, dialogs, tables and status pills.
- The shell includes a skip-to-main-content link.
- Keyboard focus-visible styling is present for buttons, links and form controls.
- The base stylesheet contains responsive breakpoints at 1300px, 850px and 560px.
- The application uses a central navigation model with role-based visibility checks.
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

## PR #30 — first visual-modernisation slice

The draft PR contains four controlled changes:

1. Replace legacy REDESY labels with APP2 in the application shell and workspace copy.
2. Update browser title and description metadata.
3. Lighten Executive Gold navigation surfaces and reserve gold for selection and interaction.
4. Refine shared shell proportions, typography and responsive content padding.

The changes do not alter workflow APIs, permissions, business rules or persisted data.

**Verification:** GitHub Actions run [#45879825572](https://github.com/domnio-ai/psc-app2/actions/runs/45879825572) was in progress when this register was written. Its result must be checked before the PR is considered verified.

## Next audit actions

1. Obtain a running APP2 preview and capture the dashboard and every major module at desktop, tablet and mobile widths.
2. Verify the sidebar, search, notification entry points, breadcrumbs, back navigation and deep links.
3. Review forms for grouping, validation, required-field clarity, unsaved changes and error recovery.
4. Review tables for density, sorting, filtering, pagination, empty states and mobile alternatives.
5. Test keyboard-only navigation, focus order, dialogs, labels, contrast and screen-reader landmarks.
6. Resolve the Documents / Document Repository naming and route ambiguity.
7. Map every workflow to its source record, permissions, state transitions, notifications, audit history and reports.
8. Consolidate the 96 stylesheet imports by ownership and shared design tokens, without mass-removing legacy rules.
9. Repeat the visual and functional checks after each module redesign.

## Completion rule

A screen is not marked complete until its visual design, interaction behaviour, responsive states, accessibility checks and connected workflow have all been verified against the running application. Source-level inspection alone is not visual sign-off.
