# REDESY management reporting and filing

The Reports & Filing tab preserves existing analytics and adds a scoped evidence report with team/individual selectors, alert reasons, deadline ageing and a printable management follow-up register. The print preview includes file reference, period, generation time, source filters, coverage, evidence IDs, recommended actions, meeting notes and signature spaces. Notes are local print annotations, not persisted decisions. Existing saved reports, exports and action tracking remain available.

## Research basis

- [Government Functional Standard GovS 002: Project Delivery](https://www.gov.uk/government/publications/project-delivery-functional-standard): connect reporting to delivery oversight, responsibilities, risks and decisions.
- [Government Data Quality Framework](https://www.gov.uk/government/publications/the-government-data-quality-framework/the-government-data-quality-framework): communicate coverage and limitations, assess data fitness for its purpose, and follow up missing information at source.

These are design references, not a claim that REDESY is certified against either framework.

## Rules and scope

Only the existing authenticated intelligence response is used. Individual associations are gated by the existing people capability. Assignment membership is not sole accountability. Current detail endpoints return at most 100 assignments and 25 research attention records; printed coverage explicitly discloses these limits and source portfolio counts. Research attention is not a full research register. Existing task, contribution and full export reports are retained elsewhere in the module.

Alerts are snapshot rules, not messages sent to staff: overdue is an open record due before the snapshot's Nairobi calendar date; due soon includes today and seven days forward; stale means no recorded update for 30 days; review and revision queues follow recorded status. Completed, archived and cancelled items do not retain active alerts. Multiple reasons can apply to one record, so reason totals are not additive. No employee scores or inferred effort are calculated.

Printing clones React-rendered DOM into a dedicated frame, so application navigation is excluded and user-entered notes are text rather than executable markup. The browser provides printer selection and Save PDF. This is a management working report, not approval of the underlying work. The existing governed PDF/DOCX/XLSX exports remain intact.

## Validation

`node work/reporting-management/model-test.mjs` verifies date boundaries, terminal statuses, deduplication, alert rules and capability gating. Production build and App2 Regression Shield are required before acceptance.
