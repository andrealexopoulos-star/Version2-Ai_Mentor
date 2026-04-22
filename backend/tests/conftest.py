"""
Compatibility shims for tests that still reference '/app/...'.

CI now checks out the repository under runner-specific paths, so these
tests need transparent path remapping to remain portable.

Also implements per-test-file `sys.modules` isolation so that files which
install module-level `sys.modules` stubs (for `supabase_client`,
`routes.deps`, `routes.auth`, `tier_resolver`, `intelligence_spine`) don't
leak state into sibling files when pytest collects them in the same run.
The leak symptom is: each file passes in isolation, but two of them run
together and the LATER file's stubs overwrite the earlier file's routes-bound
`get_sb()` — producing 500s on endpoints whose router was imported under the
earlier file's fake shape. See test_feature_flags / test_user_export.
"""

from __future__ import annotations

import builtins
import os
import sys
from pathlib import Path
import subprocess
from typing import Any, Dict


_REPO_ROOT = Path(__file__).resolve().parents[2]
_APP_ROOT = "/app"
_WORKSPACE_ROOT = "/workspace"


# Files that perform module-level `sys.modules[...] = stub` for shared deps.
# When one of these runs its module-level code, it MUST own the stub state
# for `_STUBBED_MODULE_KEYS` during every test in that file.
_STUB_OWNING_TEST_FILES = frozenset({
    "test_feature_flags.py",
    "test_llm_router_flag.py",
    "test_signals_routes.py",
    "test_user_delete_account.py",
    "test_user_export.py",
    "test_hard_delete_worker.py",
})

# The `sys.modules` keys each test file may install stubs for.
_STUBBED_MODULE_KEYS = (
    "supabase_client",
    "routes",
    "routes.auth",
    "routes.deps",
    "tier_resolver",
    "intelligence_spine",
)

# Routes modules imported by stub-owning test files. These cache bindings
# to the stubs that were live at their import time — they must be purged
# between stub-owning files so each file's `from routes import X` re-binds
# against THAT file's stubs.
_ROUTES_MODULES_TO_PURGE = (
    "routes.super_admin",
    "routes.user_settings",
    "routes.signals",
    "routes.auth",
    "routes.deps",
    "jobs.hard_delete_worker",
    "jobs",
    "routes",
)

# Per-test-file snapshot of the stubbed modules installed by that file.
# Populated during file collection; replayed before each test.
_FILE_STUB_SNAPSHOTS: Dict[str, Dict[str, Any]] = {}


def _purge_stubbed_modules() -> None:
    """Remove any cached stubs + routes-bound modules so the next test file's
    module-level imports re-resolve from scratch against its own stubs."""
    for key in list(_STUBBED_MODULE_KEYS) + list(_ROUTES_MODULES_TO_PURGE):
        sys.modules.pop(key, None)


def _snapshot_stub_state() -> Dict[str, Any]:
    """Capture the current `sys.modules` entries for the stub keys + the
    routes/jobs modules bound to them. We restore this snapshot before every
    test in the owning file so intervening files can't overwrite it."""
    snapshot: Dict[str, Any] = {}
    for key in list(_STUBBED_MODULE_KEYS) + list(_ROUTES_MODULES_TO_PURGE):
        if key in sys.modules:
            snapshot[key] = sys.modules[key]
    return snapshot


def _restore_stub_state(snapshot: Dict[str, Any]) -> None:
    """Restore `sys.modules` entries from a per-file snapshot. Keys not in
    the snapshot are removed to avoid leakage from an intervening file."""
    for key in list(_STUBBED_MODULE_KEYS) + list(_ROUTES_MODULES_TO_PURGE):
        if key in snapshot:
            sys.modules[key] = snapshot[key]
        else:
            sys.modules.pop(key, None)


# Track which files we've already prepared so the purge happens exactly once
# per file (pytest_collectstart fires both for the session-level file pickup
# AND for the Module collector).
_PURGED_FILES: set = set()


def pytest_collectstart(collector):  # noqa: D401
    """Before pytest imports a stub-owning test file, wipe any stubs left by
    a sibling file so the file's module-level `sys.modules[...] = stub` runs
    cleanly and `from routes import X` re-imports against THIS file's stubs.

    Pytest fires this hook twice per file (once for Session → file, once for
    Module collector). We only purge on the FIRST fire per filename — the
    second call arrives AFTER the module body has run and would wipe the
    fresh stubs we just installed.
    """
    # Only act on file-level collectors whose filename matches our set.
    filename = getattr(getattr(collector, "path", None), "name", None)
    if filename is None:
        # Older pytest uses `fspath` — fall back.
        fspath = getattr(collector, "fspath", None)
        if fspath is not None:
            filename = Path(str(fspath)).name
    if filename in _STUB_OWNING_TEST_FILES and filename not in _PURGED_FILES:
        _PURGED_FILES.add(filename)
        _purge_stubbed_modules()


def pytest_collectreport(report):  # noqa: D401
    """After a stub-owning file finishes collection (i.e. pytest has imported
    it and its module-level stubs are installed), snapshot that file's stub
    state so we can restore it before every test in that file runs."""
    nodeid = getattr(report, "nodeid", "") or ""
    if not nodeid:
        return
    filename = Path(nodeid).name
    if filename in _STUB_OWNING_TEST_FILES:
        _FILE_STUB_SNAPSHOTS[filename] = _snapshot_stub_state()


def pytest_runtest_setup(item):  # noqa: D401
    """Before each test, restore the `sys.modules` stub state captured when
    the test's OWN file was collected. This prevents a later file's stubs
    from overwriting an earlier file's stubs between tests."""
    fspath = getattr(item, "path", None) or getattr(item, "fspath", None)
    if fspath is None:
        return
    filename = Path(str(fspath)).name
    snapshot = _FILE_STUB_SNAPSHOTS.get(filename)
    if snapshot is not None:
        _restore_stub_state(snapshot)


def _map_app_path(path_like: Any) -> Any:
    """Map legacy absolute CI paths to the real repository root."""
    try:
        raw = os.fspath(path_like)
    except TypeError:
        return path_like

    normalized = str(raw).replace("\\", "/")
    if normalized == _APP_ROOT:
        return str(_REPO_ROOT)
    if normalized.startswith(f"{_APP_ROOT}/"):
        rel = normalized[len(_APP_ROOT) + 1 :]
        return str(_REPO_ROOT / rel)
    if normalized == _WORKSPACE_ROOT:
        return str(_REPO_ROOT)
    if normalized.startswith(f"{_WORKSPACE_ROOT}/"):
        rel = normalized[len(_WORKSPACE_ROOT) + 1 :]
        return str(_REPO_ROOT / rel)
    return path_like


def _patch_path_function(func):
    def _wrapped(path, *args, **kwargs):
        return func(_map_app_path(path), *args, **kwargs)

    return _wrapped


if not globals().get("_APP_PATH_PATCHED", False):
    _APP_PATH_PATCHED = True

    _orig_open = builtins.open
    _orig_exists = os.path.exists
    _orig_isfile = os.path.isfile
    _orig_isdir = os.path.isdir
    _orig_listdir = os.listdir
    _orig_scandir = os.scandir
    _orig_subprocess_run = subprocess.run
    _orig_path_open = Path.open
    _orig_path_read_text = Path.read_text
    _orig_path_read_bytes = Path.read_bytes
    _orig_path_exists = Path.exists
    _orig_path_is_file = Path.is_file
    _orig_path_is_dir = Path.is_dir
    _orig_path_iterdir = Path.iterdir

    def _open(file, *args, **kwargs):
        mode = args[0] if args else kwargs.get("mode", "r")
        if "b" not in mode and "encoding" not in kwargs:
            # Keep test file reads consistent across environments.
            kwargs["encoding"] = "utf-8"
        return _orig_open(_map_app_path(file), *args, **kwargs)

    def _listdir(path="."):
        return _orig_listdir(_map_app_path(path))

    def _scandir(path="."):
        return _orig_scandir(_map_app_path(path))

    def _rewrite_subprocess_args(cmd: Any) -> Any:
        if isinstance(cmd, str):
            repo_root = _REPO_ROOT.as_posix()
            return cmd.replace("/app/", f"{repo_root}/").replace(" /app", f" {repo_root}")
        if isinstance(cmd, tuple):
            return tuple(_map_app_path(arg) for arg in cmd)
        if isinstance(cmd, list):
            return [_map_app_path(arg) for arg in cmd]
        return _map_app_path(cmd)

    def _subprocess_run(*args, **kwargs):
        if args:
            remapped_cmd = _rewrite_subprocess_args(args[0])
            args = (remapped_cmd, *args[1:])
        elif "args" in kwargs:
            kwargs["args"] = _rewrite_subprocess_args(kwargs["args"])
        return _orig_subprocess_run(*args, **kwargs)

    def _path_open(self: Path, *args, **kwargs):
        return _orig_path_open(Path(_map_app_path(self)), *args, **kwargs)

    def _path_read_text(self: Path, *args, **kwargs):
        if "encoding" not in kwargs:
            kwargs["encoding"] = "utf-8"
        return _orig_path_read_text(Path(_map_app_path(self)), *args, **kwargs)

    def _path_read_bytes(self: Path, *args, **kwargs):
        return _orig_path_read_bytes(Path(_map_app_path(self)), *args, **kwargs)

    def _path_exists(self: Path) -> bool:
        return _orig_path_exists(Path(_map_app_path(self)))

    def _path_is_file(self: Path) -> bool:
        return _orig_path_is_file(Path(_map_app_path(self)))

    def _path_is_dir(self: Path) -> bool:
        return _orig_path_is_dir(Path(_map_app_path(self)))

    def _path_iterdir(self: Path):
        return _orig_path_iterdir(Path(_map_app_path(self)))

    builtins.open = _open
    os.path.exists = _patch_path_function(_orig_exists)
    os.path.isfile = _patch_path_function(_orig_isfile)
    os.path.isdir = _patch_path_function(_orig_isdir)
    os.listdir = _listdir
    os.scandir = _scandir
    subprocess.run = _subprocess_run
    Path.open = _path_open
    Path.read_text = _path_read_text
    Path.read_bytes = _path_read_bytes
    Path.exists = _path_exists
    Path.is_file = _path_is_file
    Path.is_dir = _path_is_dir
    Path.iterdir = _path_iterdir
