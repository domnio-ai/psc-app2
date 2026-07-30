# PSC App2 Administrator Guide

## Roles

- **Administrator:** accounts, roles, audit logs, all operational modules.
- **Research Manager:** assignments, research, documents, reports and team visibility.
- **Reviewer:** assigned reviews and approval decisions.
- **Research Officer:** assigned work, research collaboration and document submission.

Backend authorization is authoritative; hiding a menu item is not treated as a
security boundary.

## Account lifecycle

1. Open **Team & Users** as an Administrator.
2. Create the account with an official email, role and division.
3. Copy the one-time temporary password from the success dialog.
4. Share it only through an approved secure channel.
5. The member must change it after first sign-in.

Disabling an account or resetting its password ends existing sessions. The final
active Administrator cannot be disabled or demoted.

## Document review

Submitted documents enter **Pending Approval**. Managers may assign a reviewer.
Reviewers inspect versions, then approve or reject with correction notes. Every
decision is recorded and the author is notified.

## Audit and reporting

**Audit Logs** is Administrator-only and read-only. Filters and CSV/PDF exports
do not modify records. **Reports & Analytics** is available to Administrators
and Research Managers.

## Operational checks

- API: `/api/health` must report `healthy` and `database: connected`.
- Review failed-login events regularly.
- Deactivate departed users promptly.
- Test restoration of backups periodically.
- Rotate the JWT and database secrets under an approved maintenance window.
