import sys
from pathlib import Path


ROOT = Path('/app/backend')
sys.path.insert(0, str(ROOT))


def _read(rel_path: str) -> str:
    return (ROOT / rel_path).read_text(errors='ignore')


def test_no_asyncio_create_task_in_target_route_files():
    target_files = [
        'routes/email.py',
        'routes/integrations.py',
        'routes/ingestion_engine.py',
        'routes/hybrid_ingestion.py',
        'routes/research.py',
        'routes/marketing_intel.py',
        'routes/file_service.py',
    ]
    for rel_path in target_files:
        text = _read(rel_path)
        assert 'asyncio.create_task(' not in text, f'Found local create_task in {rel_path}'


def test_enqueue_job_used_in_target_route_files():
    expected = {
        'routes/email.py': 'email-analysis',
        'routes/integrations.py': 'drive-sync',
        'routes/ingestion_engine.py': 'website-ingestion',
        'routes/hybrid_ingestion.py': 'website-ingestion',
        'routes/research.py': 'market-research',
        'routes/marketing_intel.py': 'market-research',
        'routes/file_service.py': 'file-generation',
    }
    for rel_path, job_type in expected.items():
        text = _read(rel_path)
        assert 'enqueue_job(' in text, f'Missing enqueue_job in {rel_path}'
        assert job_type in text, f'Missing job type {job_type} in {rel_path}'


def test_redis_job_types_and_handlers_registered():
    text = _read('biqc_jobs.py')
    for job_type in [
        'email-analysis',
        'drive-sync',
        'website-ingestion',
        'market-research',
        'file-generation',
    ]:
        assert f'"{job_type}"' in text
    for handler_name in [
        '_handle_email_analysis',
        '_handle_drive_sync',
        '_handle_website_ingestion',
        '_handle_market_research',
        '_handle_file_generation',
    ]:
        assert handler_name in text


def test_conversational_routes_unchanged_from_queue_migration_scope():
    for rel_path in ['routes/soundboard.py', 'routes/boardroom.py', 'routes/calibration.py']:
        text = _read(rel_path)
        assert 'enqueue_job(' not in text, f'Conversational route should remain synchronous: {rel_path}'
