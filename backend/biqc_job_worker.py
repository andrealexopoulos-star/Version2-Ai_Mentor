"""BIQc Redis worker — sole process that consumes the job queue.

The API server (server.py) only initializes the Redis client for enqueueing;
it does NOT start the worker. Run this module as a separate process to
consume jobs from biqc-jobs:queue (e.g. via supervisor or a separate container).
"""

from __future__ import annotations

import asyncio
import logging

from biqc_jobs import biqc_jobs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main() -> None:
    await biqc_jobs.initialize()
    if not biqc_jobs.redis_connected:
        logger.warning("Redis unavailable – continuing without queue.")
        return

    await biqc_jobs.start_worker()
    logger.info("BIQc standalone Redis worker active")

    try:
        while True:
            await asyncio.sleep(60)
    finally:
        await biqc_jobs.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
