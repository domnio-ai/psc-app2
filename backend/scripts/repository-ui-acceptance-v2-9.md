# App2 Repository V2.9 — Final UI Acceptance Checklist

Use two or more test accounts where required. Do not use production-sensitive documents for destructive or access-control tests.

## 1. Intake and approval
- Upload one small governed test document.
- Confirm a reviewer is mandatory.
- Confirm self-review is blocked.
- Confirm record number is assigned.
- Submit, review and approve.
- Confirm published record becomes an Active Record.

## 2. Version integrity
- Create an improvement assignment.
- Upload a revised version.
- Confirm the official published version remains unchanged until approval.
- Confirm immutable version history remains available.
- Confirm the Record Workspace marks exactly one current version.

## 3. Supersession
- Use two safe approved test records.
- Supersede the older record with the newer record.
- Confirm the older record becomes historical/superseded.
- Confirm the replacement remains current.
- Confirm Felix and Record Workspace identify the authoritative record.

## 4. Retention, review and disposition
- Assign a retention schedule.
- Set a next review date.
- Complete a governance review using Confirm Current.
- Test Needs Improvement.
- Test Supersede Required.
- Place a legal/audit hold and confirm destruction is blocked.
- Release the hold.
- Request destruction and confirm it enters the independent deletion approval flow rather than deleting immediately.

## 5. Protection and secure reader
- Set NAMED_USERS.
- Give one ordinary user explicit reader access.
- Confirm a different unauthorised ordinary user cannot open the record.
- Confirm the named reader can open it.
- Disable Download and confirm the UI control is unavailable and direct API download is denied.
- Disable Copy and confirm copy controls/shortcuts are blocked.
- Disable Print and confirm print is blocked.
- Enable watermark and confirm repeated viewer/record/time watermarking is visible.
- Confirm the audit trail records View, Download, Copy, Print and policy changes as applicable.

## 6. Scope and RBAC
- Researcher: sees only own/authorised Repository work.
- Assistant Director: sees and manages only authorised team scope.
- Deputy Director: sees and manages only authorised team scope.
- Director: sees authorised directorate/organisation scope according to App2 policy.
- System Admin: administrative capabilities remain available without silently bypassing protected record capabilities.
- Contextual reviewer: can review assigned records without receiving broad permanent authority.

## 7. Operational queues
- My Record Work dropdown filters the Record Library correctly.
- Manager Attention dropdown filters correctly.
- Disposition & Continuity dropdown filters correctly.
- Only one queue group is open at a time.
- Clear Queue restores the normal library.

## 8. Assurance
- Open one Record Workspace → Assurance.
- Confirm findings navigate to the relevant tabs.
- Confirm labels are READY / READY WITH MINOR ISSUES / NEEDS REVISION / SIGNIFICANT GAPS.
- Confirm Repository Assurance Overview filters the existing Record Library.
- Confirm no staff score or ranking appears.

## 9. Search, pagination and usability
- Search by title/record number.
- Test Advanced Search filters.
- Save and reload a Saved View.
- Delete a Saved View.
- Confirm Previous / Next pagination is visible and usable.
- Confirm Felix does not cover pagination.
- Confirm compact dropdown-first layout remains uncluttered.
- Confirm light/dark/App2 themes remain readable.

## 10. Notifications and calendar
- Reviewer assignment generates notification.
- Review due soon generates notification.
- Overdue governance generates notification.
- Improvement overdue generates notification.
- Supersession generates notification.
- Repository review dates appear on Calendar.
- Retention/disposition dates appear on Calendar.
- Improvement deadlines appear on Calendar.

## 11. Deployment readiness
- API health returns healthy/database connected.
- Frontend production build passes.
- Backend syntax/check passes.
- Full regression suite passes.
- Repository migrations 033–036 verify successfully.
- Automated V2.9 release validation returns READY FOR RELEASE or READY WITH ACTIONS.
- Review every warning/action before production sign-off.
- Verify backup/restore procedure on a non-production copy before deployment.
