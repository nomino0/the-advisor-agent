import asyncio
from sqlalchemy import text
import logging
from app.db.session import engine

logger = logging.getLogger("cloudwise")


async def add_rag_columns():
    async with engine.begin() as conn:
        try:
            logger.info("Adding columns to 'rag_documents' table...")
            await conn.execute(text("ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''"))
            await conn.execute(text("ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS target_agent VARCHAR(50) DEFAULT 'general'"))
            logger.info("Columns added successfully.")
        except Exception as e:
            logger.error("Error adding columns: %s", e)


if __name__ == "__main__":
    asyncio.run(add_rag_columns())
