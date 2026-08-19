# App2 Feature Contracts

**Status:** Protected baseline contract  
**Purpose:** Define behavior that future App2 changes must preserve unless a deliberate contract change is approved and checkpointed.

## 1. Non-regression rule

A feature improvement is not complete if it removes, hides, weakens, or breaks an existing working capability. Future patches must be narrowly scoped, declare every file they may modify, pass the App2 Regression Shield, and create a recoverable checkpoint before significant changes.

## 2. Data safety contract

- PostgreSQL `psc_app2` is the authoritative application database.
- Existing records must never be recreated merely because a UI page appears empty.
- Before schema changes, create a `pg_dump` safety backup.
- Application code must not depend on a new table/column until its migration has successfully completed.
- Migrations should be additive and idempotent where practical.
- A decrease in protected core-record counts requires an explicit new approved checkpoint.

Protected core records:
- users
- assignments
- research_projects
- knowledge_items

## 3. Task ownership and task-report contract

A task is owned by its assigned `owner_id`. The task owner is the report author.

Required workflow:

`Assigned Task -> Start Work -> Draft Report -> Save Draft -> Preview -> Return to Edit if needed -> Preview -> Submit to Reviewer -> Submitted Version Locked -> Reviewer Decision`

Reviewer decisions:
- Approve
- Request Changes / Revision
- Reject

Rules:
- Only the actual task owner may edit or submit that task report.
- Managers/reviewers must not silently edit the owner's submitted report.
- Drafts remain editable by the owner.
- Preview does not submit.
- Submission locks the submitted version.
- A revision request preserves the submitted version and reopens/creates an editable revision.
- Rejection must preserve history and requires controlled reopening before more editing.
- Final report generation occurs only after approval and remains an authorized reviewer/approver action.
- Final approved output is promoted to the Documents Repository with provenance rather than being re-uploaded as an unrelated file.

## 4. Assignment contract

- Assignment membership and task ownership are contextual to the assignment.
- A task owner can update their own task within workflow rules.
- Reviewers are contextual to the relevant assignment/work item.
- Assignment review must not bypass accepted task-report requirements.
- Existing assignment records, members, tasks, history, comments, attachments, reviews, and outputs must survive unrelated feature changes.

## 5. Research contract

Internal research workflow:

`Research creation -> Planning -> Related Assignments -> Work/Tasks -> Resources & Evidence -> Assignment Outputs -> Research Report -> Preview -> Submit -> Review -> Revision if needed -> Approve -> Generate Final Report -> Documents Repository -> Felix indexing`

Rules:
- One research project may relate to multiple assignments.
- Research reviewers are contextual to the research item.
- Submitted report versions are immutable during review.
- Approval and publication/final generation are distinct controlled steps.
- Research records must not disappear because a reviewer/link migration is missing.

## 6. External completed-research import contract

External imports do **not** create an internal research workspace.

Required properties:
- no workspace
- no assignments
- no tasks
- no milestones
- no internal report builder

External flow:

`Import -> Review Reader -> Approve / Request Revision / Reject -> Published Documents Repository record`

Revisions preserve older versions. Approved/published external research may become Felix-eligible subject to App2 permissions.

## 7. Documents Repository contract

The Documents Repository is the single source of truth for actual controlled files.

- Workflow modules reference documents; they do not create competing physical repositories.
- Versions and provenance are preserved.
- Final approved reports are promoted into the repository through controlled workflow.
- Access remains governed by RBAC.

## 8. Felix contract

Felix is an App2-native evidence assistant.

- It must respect App2 RBAC.
- It must not expose evidence a user cannot access.
- Approved/permitted documents and structured App2 records are the evidence source.
- Suggestions must never silently rewrite controlled documents.
- Citations/provenance must remain traceable.

## 9. UI/accessibility contract

- Existing themes remain available unless a deliberate design migration is approved.
- Low-Contrast Navy remains an additional selectable theme rather than silently remapping existing preferences.
- User-facing text must remain at least 12px.
- Critical actions must be distinguishable by text/icon/role as well as color.
- Workflow status and next action should be visually distinct.
- Destructive actions must be visually and semantically distinct from approval/primary actions.

## 10. Security contract

Future changes must preserve:
- authenticated APIs
- strict RBAC
- restricted CORS
- secure secret handling
- production protection/disablement of API documentation where applicable
- no direct external exposure of PostgreSQL or Ollama
- auditability of important workflow actions

## 11. Change-control contract

Every future patch must:
1. declare its purpose;
2. declare an explicit file allowlist;
3. declare whether it changes database schema;
4. identify protected contracts affected;
5. create a pre-change checkpoint;
6. verify source/workflow signatures;
7. run backend syntax checks;
8. run frontend production build when frontend changes;
9. verify protected database counts/schema;
10. fail and restore if verification fails.

Large shared-file replacement is prohibited for routine fixes. `src/App.tsx` and `backend/src/app.js` are guarded shared files until modularization removes their mixed responsibilities.
