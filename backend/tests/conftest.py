"""
Compatibility shims for tests that still reference '/app/...'.

CI now checks out the repository under runner-specific paths, so these
tests need transparent path remapping to remain portable.
"""

from __future__ import annotations

import builtins
import os
from pathlib import Path
import subprocess
from typing import Any


_REPO_ROOT = Path(__file__).resolve().parents[2]
_APP_ROOT = "/app"
_WORKSPACE_ROOT = "/workspace"


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
