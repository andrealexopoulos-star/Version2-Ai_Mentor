import json
from pathlib import Path


def test_top100_catalog_exists_and_has_100_metrics():
    path = Path("/app/backend/business_brain_top100_catalog.json")
    assert path.exists(), "Top100 catalog file missing"

    data = json.loads(path.read_text())
    assert isinstance(data, list)
    assert len(data) == 100

    ids = [row.get("id") for row in data]
    assert len(set(ids)) == 100
    assert min(ids) == 1
    assert max(ids) == 100


def test_top100_catalog_required_fields_present():
    path = Path("/app/backend/business_brain_top100_catalog.json")
    data = json.loads(path.read_text())

    required = {"id", "metric", "category", "description", "formula", "source"}
    for row in data:
        assert required.issubset(row.keys())
        assert str(row["metric"]).strip()
        assert str(row["category"]).strip()
        assert str(row["source"]).strip()
