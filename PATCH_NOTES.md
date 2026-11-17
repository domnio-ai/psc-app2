# App2 Task Report workflow patch

This is a focused overlay patch for the existing App2 project. It does not include a database migration and must not be used as a replacement for the complete project.

## Changed areas

- `src/modules/assignments/components/TaskSectionWorkspace.tsx`: debounced server auto-save for the existing Task Report editor, visible save status, bounded retry after save failures, conflict display, and save-before-preview.
- `src/modules/tasks/TaskReportSectionPanel.tsx`: forwards the auto-save option through the existing shared editor.
- `src/App.tsx`: sends the auto-save flag and expected draft timestamp; avoids per-keystroke history refresh and UI save notifications.
- `src/modules/tasks/taskReportOrchestration.ts` and `src/modules/tasks/taskWorkspaceMapping.ts`: keep editor HTML intact across payload creation, save readback, and task reopen.
- `backend/src/app.js`: applies a bounded 12 MB JSON body limit only to Task Report save/preview routes (other JSON endpoints remain at 1 MB), allows up to 750 KB per formatted structured section, uses a safe rich-content allowlist for Task Report fields; locks and rechecks the task row inside the transaction; rejects stale auto-save revisions and prevents a save from changing a non-Draft task back into a draft; skips repository-version and audit/history creation for auto-save; uses rich DOCX rendering only for final Task Report generation.
- `backend/src/task-report-formatting.js`: allowlist sanitizer and controlled HTML-to-DOCX conversion for headings, paragraphs, lists, tables, supported formatting, hyperlinks, and safe embedded image handling.
- `backend/test/task-report-autosave-richcontent-contract.test.js` and the updated Task Report workflow contract tests: source-level regression checks for auto-save, save-before-preview, concurrency protection, and rich-content persistence.

## Apply safely

1. Back up the current versions of all files listed in this ZIP before extracting it into the App2 project root.
2. Extract the ZIP preserving its folder structure. Do not copy the patch's test or notes into another directory.
3. No database migration is intended for this patch. Do not run database setup/migration commands as part of applying it.
4. From the full App2 project root, run:

   ```powershell
   node --test backend/test/task-report-autosave-richcontent-contract.test.js
   npm.cmd --prefix backend test
   npm.cmd run build
   ```

5. Then manually test a disposable Task Report: type, wait for “All changes saved”, reload/reopen, verify formatting, preview, submit, request changes, revise, resubmit, approve, and generate the final DOCX. Confirm an auto-save cannot overwrite a submitted/approved version.

## Important validation notes

The focused bundle did not include `node_modules` or the complete database migration/runtime setup. Syntax and source-contract checks can be run against this patch in isolation, but the full backend suite, TypeScript build, live PostgreSQL workflow, and actual DOCX rendering must be run in the complete App2 working folder after overlaying the patch. This patch does not claim those integration checks have already passed.
