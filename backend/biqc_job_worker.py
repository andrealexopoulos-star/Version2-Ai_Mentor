"""Standalone BIQc Redis worker entrypoint.

Optional process runner for environments that want a dedicated queue consumer.
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
