#!/usr/bin/env python3
"""Incrementally index an authorized repository into Felix PostgreSQL."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


APP2_ROOT = Path(__file__).resolve().parents[1]
AI_ROOT = APP2_ROOT.parent / "ai-research-service"
sys.path.insert(0, str(AI_ROOT))

from app.services.repository_index import git_metadata, incremental_plan, scan_repository  # noqa: E402


def load_local_environment(path: Path) -> None:
    """Load simple local development values without logging them or overriding the process."""
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() and name.strip() not in os.environ:
            os.environ[name.strip()] = value.strip()


def apply_migration(connection, path: Path) -> None:
    version = path.name
    with connection.cursor() as cursor:
        cursor.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version VARCHAR(120) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())")
        cursor.execute("SELECT 1 FROM schema_migrations WHERE version=%s", (version,))
        if cursor.fetchone():
            return
        cursor.execute(path.read_text(encoding="utf-8"))
        cursor.execute("INSERT INTO schema_migrations(version) VALUES(%s)", (version,))


def persist(connection, root: Path, name: str, scanned, branch: str | None, commit: str | None) -> dict:
    with connection.cursor() as cursor:
        cursor.execute(
            """INSERT INTO indexed_repositories(name,root_path,branch,commit_hash)
            VALUES(%s,%s,%s,%s) ON CONFLICT(root_path) DO UPDATE SET
            name=EXCLUDED.name,branch=EXCLUDED.branch,commit_hash=EXCLUDED.commit_hash,updated_at=NOW()
            RETURNING id""", (name, str(root), branch, commit),
        )
        repository_id = cursor.fetchone()[0]
        cursor.execute("SELECT file_path,content_hash FROM repository_files WHERE repository_id=%s", (repository_id,))
        existing = dict(cursor.fetchall())
        plan = incremental_plan(scanned, existing)
        cursor.execute("INSERT INTO repository_index_jobs(repository_id) VALUES(%s) RETURNING id", (repository_id,))
        job_id = cursor.fetchone()[0]
        try:
            for item in [*plan["added"], *plan["changed"]]:
                cursor.execute(
                    """INSERT INTO repository_files(repository_id,file_path,content_hash,file_size,modified_at,language,classes,functions,api_routes,database_models,react_components,dependencies,test_metadata)
                    VALUES(%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb,%s::jsonb,%s::jsonb,%s::jsonb,%s::jsonb)
                    ON CONFLICT(repository_id,file_path) DO UPDATE SET content_hash=EXCLUDED.content_hash,file_size=EXCLUDED.file_size,
                    modified_at=EXCLUDED.modified_at,language=EXCLUDED.language,classes=EXCLUDED.classes,functions=EXCLUDED.functions,
                    api_routes=EXCLUDED.api_routes,database_models=EXCLUDED.database_models,react_components=EXCLUDED.react_components,
                    dependencies=EXCLUDED.dependencies,test_metadata=EXCLUDED.test_metadata,indexed_at=NOW()""",
                    (repository_id, item.file_path, item.content_hash, item.file_size, item.modified_at, item.language,
                     json.dumps(item.classes), json.dumps(item.functions), json.dumps(item.api_routes),
                     json.dumps(item.database_models), json.dumps(item.react_components), json.dumps(item.dependencies), json.dumps(item.test_metadata)),
                )
            if plan["removed"]:
                cursor.execute("DELETE FROM repository_files WHERE repository_id=%s AND file_path=ANY(%s)", (repository_id, plan["removed"]))
            counts = {key: len(value) for key, value in plan.items()}
            cursor.execute(
                """UPDATE repository_index_jobs SET status='Completed',completed_at=NOW(),scanned_files=%s,added_files=%s,
                changed_files=%s,unchanged_files=%s,removed_files=%s WHERE id=%s""",
                (len(scanned), counts["added"], counts["changed"], counts["unchanged"], counts["removed"], job_id),
            )
            cursor.execute("UPDATE indexed_repositories SET branch=%s,commit_hash=%s,last_indexed_at=NOW(),updated_at=NOW() WHERE id=%s", (branch, commit, repository_id))
            return {"repository": name, "branch": branch, "commit": commit, "scanned": len(scanned), **counts}
        except Exception as error:
            cursor.execute("UPDATE repository_index_jobs SET status='Failed',completed_at=NOW(),error_message=%s WHERE id=%s", (str(error)[:4000], job_id))
            raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repository", nargs="?", default=str(APP2_ROOT), help="Authorized repository root")
    parser.add_argument("--name", default="app2")
    parser.add_argument("--max-file-bytes", type=int, default=1_000_000)
    parser.add_argument("--dry-run", action="store_true", help="Scan and report without connecting to PostgreSQL")
    args = parser.parse_args()
    root = Path(args.repository).resolve()
    if not root.is_dir():
        raise SystemExit(f"Repository directory does not exist: {root}")
    scanned = scan_repository(root, max_file_bytes=args.max_file_bytes)
    branch, commit = git_metadata(root)
    if args.dry_run:
        print(json.dumps({"repository": args.name, "root": str(root), "branch": branch, "commit": commit, "scanned": len(scanned), "write": False}, indent=2))
        return
    load_local_environment(AI_ROOT / ".env")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required. Configure the AI service environment or use --dry-run.")
    try:
        import psycopg
    except ModuleNotFoundError as error:
        raise SystemExit(
            "psycopg is required for database writes. Activate the AI service virtual environment "
            "or run its Python executable; --dry-run works without the database driver."
        ) from error
    with psycopg.connect(database_url) as connection:
        for migration in sorted((AI_ROOT / "migrations").glob("*.sql")):
            apply_migration(connection, migration)
        summary = persist(connection, root, args.name, scanned, branch, commit)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
