#!/usr/bin/env python3
"""Validate local Supabase edge functions with optional remote connectivity check.

This script is intentionally lightweight so it can run in CI or local shells:
- Verifies expected local function layout.
- Runs `deno check` when Deno is installed.
- Optionally validates Supabase API access via `supabase functions list`.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def run_command(command: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=str(cwd),
        text=True,
        capture_output=True,
        check=False,
    )


def discover_functions(functions_dir: Path) -> list[Path]:
    if not functions_dir.exists():
        return []
    return sorted(
        path
        for path in functions_dir.iterdir()
        if path.is_dir() and (path / "index.ts").exists()
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate Supabase edge functions in supabase/functions."
    )
    parser.add_argument(
        "--project-ref",
        default=os.environ.get("SUPABASE_PROJECT_REF", "").strip(),
        help="Supabase project ref for optional remote auth validation.",
    )
    parser.add_argument(
        "--strict-prereqs",
        action="store_true",
        help="Fail if Deno is unavailable.",
    )
    parser.add_argument(
        "--skip-remote-check",
        action="store_true",
        help="Skip Supabase remote API validation even if project ref/token are set.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    functions_dir = repo_root / "supabase" / "functions"

    supabase_path = shutil.which("supabase")
    if not supabase_path:
        print("ERROR: `supabase` CLI not found on PATH.")
        return 1

    deno_path = shutil.which("deno")
    if not deno_path:
        message = "WARNING: `deno` not found. Skipping TypeScript type checks."
        if args.strict_prereqs:
            print(f"ERROR: {message} Install Deno or run without --strict-prereqs.")
            return 1
        print(message)

    functions = discover_functions(functions_dir)
    if not functions:
        print(f"ERROR: No edge functions found under {functions_dir}")
        return 1

    print(f"Discovered {len(functions)} edge function(s).")

    failures = 0
    for function_dir in functions:
        index_file = function_dir / "index.ts"
        print(f"- {function_dir.name}: index.ts found")
        if deno_path:
            check_result = run_command(["deno", "check", str(index_file)], cwd=repo_root)
            if check_result.returncode == 0:
                print(f"  deno check: PASS ({function_dir.name})")
            else:
                failures += 1
                print(f"  deno check: FAIL ({function_dir.name})")
                if check_result.stdout.strip():
                    print(check_result.stdout.strip())
                if check_result.stderr.strip():
                    print(check_result.stderr.strip())

    should_check_remote = not args.skip_remote_check
    project_ref = args.project_ref
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if should_check_remote and project_ref and token:
        print(f"Running Supabase API connectivity check for project `{project_ref}`...")
        list_result = run_command(
            [
                "supabase",
                "functions",
                "list",
                "--project-ref",
                project_ref,
                "--workdir",
                ".",
            ],
            cwd=repo_root,
        )
        if list_result.returncode == 0:
            print("Supabase API check: PASS")
        else:
            failures += 1
            print("Supabase API check: FAIL")
            if list_result.stdout.strip():
                print(list_result.stdout.strip())
            if list_result.stderr.strip():
                print(list_result.stderr.strip())
    elif should_check_remote:
        print(
            "Skipping Supabase API check (set SUPABASE_PROJECT_REF and "
            "SUPABASE_ACCESS_TOKEN to enable)."
        )

    if failures:
        print(f"Validation completed with {failures} failure(s).")
        return 1

    print("Validation completed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
