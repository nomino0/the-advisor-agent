import asyncio
from sqlalchemy import text
from app.db.session import engine

async def add_column():
    async with engine.begin() as conn:
        try:
            print("Adding 'status' column to 'knowledge_base_sources' table...")
            await conn.execute(text("ALTER TABLE knowledge_base_sources ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'pending'"))
            print("Column added successfully.")
        except Exception as e:
            print(f"Error adding column: {e}")

if __name__ == "__main__":
    asyncio.run(add_column())
