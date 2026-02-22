import asyncio
from sqlalchemy import text
import logging
from app.db.session import engine

logger = logging.getLogger("cloudwise")


async def add_column():
    async with engine.begin() as conn:
        try:
            logger.info("Adding 'status' column to 'knowledge_base_sources' table...")
            await conn.execute(text("ALTER TABLE knowledge_base_sources ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'pending'"))
            logger.info("Column added successfully.")
        except Exception as e:
            logger.error("Error adding column: %s", e)


if __name__ == "__main__":
    asyncio.run(add_column())
