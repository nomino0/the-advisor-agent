import asyncio
from sqlalchemy import text
from app.db.session import engine

async def add_rag_columns():
    async with engine.begin() as conn:
        try:
            print("Adding columns to 'rag_documents' table...")
            await conn.execute(text("ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''"))
            await conn.execute(text("ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS target_agent VARCHAR(50) DEFAULT 'general'"))
            print("Columns added successfully.")
        except Exception as e:
            print(f"Error adding columns: {e}")

if __name__ == "__main__":
    asyncio.run(add_rag_columns())
