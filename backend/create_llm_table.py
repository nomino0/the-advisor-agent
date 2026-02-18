import asyncio
from sqlalchemy import text
import structlog

# Simple logger setup for standalone script
logger = structlog.get_logger()

from app.db.session import engine

async def create_table():
    try:
        async with engine.begin() as conn:
            # Create table if not exists with all columns
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS llm_providers (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR NOT NULL UNIQUE,
                    provider_type VARCHAR DEFAULT 'openai',
                    base_url VARCHAR NOT NULL,
                    api_key VARCHAR NOT NULL,
                    models JSONB DEFAULT '[]'::jsonb,
                    priority INTEGER DEFAULT 10,
                    is_active BOOLEAN DEFAULT TRUE
                );
            """))
            
            # Add missing columns if table already existed (idempotency for existing table)
            # We catch errors if column exists, or check first. 
            # Simplified approach: Try ADD COLUMN, ignore if exists error (Postgres specific: IF NOT EXISTS is only for table)
            
            # Check if columns exist
            result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='llm_providers';
            """))
            existing_columns = [row[0] for row in result.fetchall()]
            
            if 'provider_type' not in existing_columns:
                print("Adding provider_type column...")
                await conn.execute(text("ALTER TABLE llm_providers ADD COLUMN provider_type VARCHAR DEFAULT 'openai';"))
                
            if 'priority' not in existing_columns:
                print("Adding priority column...")
                await conn.execute(text("ALTER TABLE llm_providers ADD COLUMN priority INTEGER DEFAULT 10;"))

        print("Table llm_providers is up to date.")
    except Exception as e:
        print(f"Error creating/updating table: {e}")

if __name__ == "__main__":
    asyncio.run(create_table())
