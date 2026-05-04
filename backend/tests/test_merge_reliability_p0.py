import os
import sys

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from jobs.merge_health_check import _probe_url_for_category


def test_merge_health_probe_routes_file_storage():
    assert _probe_url_for_category("file_storage").endswith("/filestorage/v1/files?page_size=1")
    assert _probe_url_for_category("filestorage").endswith("/filestorage/v1/files?page_size=1")


def test_merge_health_probe_routes_ticketing():
    assert _probe_url_for_category("ticketing").endswith("/ticketing/v1/tickets?page_size=1")
