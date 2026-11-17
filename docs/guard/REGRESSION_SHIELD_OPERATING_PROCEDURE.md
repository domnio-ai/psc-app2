# App2 Regression Shield — Operating Procedure

## Normal development rule

No feature patch becomes the new App2 baseline merely because it builds.

A patch is approved only after:
1. current baseline verification;
2. patch-manifest validation;
3. pre-patch PostgreSQL + source checkpoint;
4. patch application;
5. changed-file allowlist comparison;
6. full regression verification;
7. post-patch checkpoint.

## Future patch manifest

Every patch should contain `APP2_PATCH_MANIFEST.json`.

For a normal module file, list the path under `allowed_files`.

For a guarded shared file such as `src/App.tsx` or `backend/src/app.js`, the patch must additionally include a `protected_shared_file_overrides` record explaining why that shared file must change. The guard requires the file to still match the most recently approved checkpoint before allowing another modification.

## Why this protects App2

The guard protects four separate failure modes:

- **Data disappearance:** current core record counts cannot silently fall below the approved baseline.
- **Missing migrations/schema:** required tables and task-report columns are checked.
- **Workflow regression:** key source signatures for task-report, review, Research, Documents and authorization are checked.
- **Unrelated code replacement:** post-patch hashes are compared with the patch allowlist.

## Modularization remains the next structural improvement

The shield protects the current monolith while App2 is gradually split into independent frontend/backend modules. Modularization should be behavior-preserving and performed in small, testable slices.
