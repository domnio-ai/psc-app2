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

## 12. Task, Assignment, and Research report draft continuity

Editable report content is durable workflow data, not temporary screen state.

- Save Draft, preview, section navigation, and closing an editable report workspace must save the current editor value before proceeding.
- If a save fails, keep the workspace open, retain the current editor value, and show the save error. A failed save must never be presented as successful persistence.
- Task, Assignment, and Research reports must preserve supported HTML structure and formatting across save, reopen, and preview. Sanitizers may remove unsafe markup but must retain the supported style and structure allowlists.
- Preview must render the latest editor value with the same supported formatting as the editor. A preview shown after a failed save must be explicitly identified as unsaved and must not be treated as a persisted draft.
- `backend/test/report-draft-persistence-lock-v1.test.js` is the regression lock for close/save ordering, task draft mapping, and supported rich-text formatting. Run it with the backend test suite after changes to these workflows or the report editor.
- Whole-document Task drafts stored in `blank_content` or the generated report HTML count as existing drafts and remain available from the task list.
- The server-saved Task report mode takes precedence over a stale browser mode cache when a draft is reopened; a failed save or close must leave the editor open.
- Task report writes are serialized per workspace. A short debounced background save persists edits after typing pauses; Save, Preview, Submit, and Close also flush the latest editor value before proceeding. Each write reads the authoritative Task revision before writing so overlapping requests cannot produce false success or overwrite newer work. Task editors reopen from the Task-specific context endpoint, not a stale Assignment list row.
- Approval of a submitted Task report automatically invokes final report generation and Repository publication. If publication fails, the approved task remains available for a controlled retry and the failure is shown to the reviewer.
- Approval of a submitted Research report immediately attempts controlled final generation and Repository publication. Missing governed evidence or another publication blocker leaves the approved snapshot intact and exposes a clear retry path.
- Assignment report workspace close actions save dirty section content before leaving, just like preview and section navigation.
- Meeting minutes Repository drafts retain their allowlisted document structure after sanitization and use trusted App2 reader styling; stored embedded styles are never executed. Approved minutes remain formatted PDFs and publish only after the authorised reviewer decision.

### Workspace and reader interoperability

- Task Report background saves are debounced, serialized, and revision-checked. Typing remains buffered in Lexical, with at most one background save in flight; explicit Save, Preview, Submit, and Close flush the latest value. The saved indicator advances only after the server confirms persistence and returns the requested section content. If persistence fails or the server returns blank/stale content, show an error and keep the current editor content open for retry. This save behavior is a protected App2 workspace contract.
- Task, Assignment and Research report previews preserve safe embedded template CSS inside their isolated reader frame, including page, body and responsive rules. Unsafe imports, external CSS resources and executable CSS constructs are removed. Historical embedded WebP images are converted for readers that do not support them.
- Task Report reader formatting mirrors the Lexical editor's supported typography, paragraph rhythm, table presentation and A4 page sizing. Reader users can zoom from 50% to 150%, reset to 100%, or fit the page to the available width. This reader behavior is protected and covered by `backend/test/task-report-autosave-richcontent-contract.test.js`.
- Task Report submission restores the task's eligible assigned reviewer when reopening its editor and reports success only after the server confirms the submitted state. Reviewer approval must finalize the immutable approved version as a published Task Final Report PDF before the task is marked complete. These behaviors are protected by the Task Report contract, lifecycle, and PSC branding tests.
- Assignment, Research and Task report endpoints accept bounded large report payloads up to their documented per-section limits; general API routes retain the normal small payload limit.
- Repository document lists enforce the same effective per-document access policy and named-reader grants as direct document reads. A protected document must not appear in a list visible to an unauthorised user.
- Research portfolio metric cards open the shared command-centre popup with the matching authorised exact records. Assignment Overview provides an “Assigned to me” card for active task jobs and opens the selected exact task through the existing authorised task workflow.
- These behaviors are covered by `backend/test/report-draft-persistence-lock-v1.test.js`, `backend/test/task-report-autosave-richcontent-contract.test.js`, `backend/test/research-workspace-population-navigation-v1.test.js`, and the Research, Repository, and report-reader regression suites.
